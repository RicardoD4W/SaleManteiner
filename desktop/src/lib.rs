use std::error::Error;
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, Url, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_updater::UpdaterExt;

const SERVER_READY_TIMEOUT: Duration = Duration::from_secs(30);
const SIDECAR_NAME: &str = "salemanteiner-server";

fn free_port() -> Result<u16, std::io::Error> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn wait_until_listening(port: u16, timeout: Duration) -> bool {
    let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

fn start_server(app: &AppHandle) -> Result<(u16, CommandChild), Box<dyn Error>> {
    let resources = app.path().resource_dir()?;
    let entrypoint_path = resources.join("server").join("dist").join("index.js");
    let entrypoint = dunce::simplified(&entrypoint_path);
    if !entrypoint.exists() {
        return Err(format!(
            "no encuentro el server compilado en {}",
            entrypoint.display()
        )
        .into());
    }
    let web_path = resources.join("web");
    let web_dir = dunce::simplified(&web_path);
    // La carpeta de datos NO la decide el shell: la resuelve el server (una sola
    // fuente de la verdad) y nunca es la de instalación (el desinstalador de NSIS
    // borra $INSTDIR entero, y con los datos adentro se perderían las ventas).
    let port = free_port()?;
    log::info!(
        "[server] recursos={} entrypoint={} web={}",
        resources.display(),
        entrypoint.display(),
        web_dir.display()
    );
    let (events, child) = app
        .shell()
        .sidecar(SIDECAR_NAME)?
        .args([entrypoint.to_string_lossy().to_string()])
        .current_dir(&resources)
        .env("PORT", port.to_string())
        .env(
            "SALEMANTEINER_WEB_DIR",
            web_dir.to_string_lossy().to_string(),
        )
        .spawn()?;

    tauri::async_runtime::spawn(async move {
        let mut events = events;
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    log::info!("[server] {}", String::from_utf8_lossy(&line).trim_end())
                }
                CommandEvent::Stderr(line) => {
                    log::warn!("[server] {}", String::from_utf8_lossy(&line).trim_end())
                }
                CommandEvent::Error(message) => log::error!("[server] {message}"),
                CommandEvent::Terminated(payload) => {
                    log::error!("[server] terminó: {:?}", payload);
                    break;
                }
                _ => {}
            }
        }
    });

    if !wait_until_listening(port, SERVER_READY_TIMEOUT) {
        return Err(format!(
            "el server no escuchó en el puerto {port} en {SERVER_READY_TIMEOUT:?}"
        )
        .into());
    }
    Ok((port, child))
}

fn kill_sidecar(app: &AppHandle) {
    let child = app.state::<Mutex<Option<CommandChild>>>();
    if let Ok(mut guard) = child.lock()
        && let Some(child) = guard.take()
    {
        let _ = child.kill();
    }
}

fn check_for_updates(app: &AppHandle) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match handle.updater() {
            Ok(updater) => updater,
            Err(error) => {
                log::warn!("[updater] no puedo crear el updater: {error}");
                return;
            }
        };
        let update = match updater.check().await {
            Ok(Some(update)) => update,
            Ok(None) => {
                log::info!("[updater] la app está al día");
                return;
            }
            Err(error) => {
                log::warn!("[updater] la comprobación falló (sin red o sin release): {error}");
                return;
            }
        };
        let current = handle.package_info().version.to_string();
        let latest = update.version.clone();
        log::info!("[updater] hay versión nueva: {current} -> {latest}");
        let confirmed = handle
            .dialog()
            .message(format!(
                "Hay una versión nueva de SaleManteiner ({current} → {latest}).\n\n¿Instalarla ahora?"
            ))
            .blocking_show();
        if !confirmed {
            log::info!("[updater] el usuario pospuso la actualización");
            return;
        }
        let mut downloaded = 0u64;
        let mut total = 0u64;
        let result = update
            .download_and_install(
                |chunk, size| {
                    downloaded += chunk as u64;
                    if let Some(size) = size {
                        total = size;
                    }
                    log::info!("[updater] descargando {downloaded}/{total} bytes");
                },
                || log::info!("[updater] descarga completa"),
            )
            .await;
        if let Err(error) = result {
            log::error!("[updater] falló la instalación: {error}");
            handle
                .dialog()
                .message(format!("No se pudo instalar la actualización:\n\n{error}"))
                .blocking_show();
            return;
        }
        log::info!("[updater] instalada; reiniciando la app");
        handle.restart();
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let (port, child) = start_server(&handle)?;
            app.manage(Mutex::new(Some(child)));

            if let Some(window) = app.get_webview_window("main") {
                let url = Url::parse(&format!("http://127.0.0.1:{port}"))?;
                window.navigate(url)?;
            }
            check_for_updates(&handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                kill_sidecar(window.app_handle());
            }
        })
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                kill_sidecar(app);
            }
        }),
        Err(error) => eprintln!("no se pudo arrancar SaleManteiner: {error}"),
    }
}
