import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateCustomerInput, UpdateCustomerInput } from '../../schemas/customers';
import type { Customer } from '../../schemas/customers';
import {
  CustomerFormSchema,
  type CustomerFormInput,
  type CustomerFormOutput,
} from '../../schemas/forms';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';
import { useAnimatedClose } from '../../hooks/useExitAnimation';
import { useUpdateCustomer } from '../../hooks/useUpdateCustomer';
import { apiErrorMessage } from '../../api/client';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';

type CustomerFormModalProps =
  | { mode: 'create'; onClose: () => void }
  | { mode: 'edit'; customer: Customer; onClose: () => void };

export function CustomerFormModal(props: CustomerFormModalProps) {
  const { onClose } = props;
  const { closing, close } = useAnimatedClose(onClose);
  const create = useCreateCustomer();
  const update = useUpdateCustomer();

  const fieldId = useId();
  const nameInputId = `${fieldId}-name`;
  const nameErrorId = `${fieldId}-name-error`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
    setError,
  } = useForm<CustomerFormInput, unknown, CustomerFormOutput>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: {
      name: props.mode === 'edit' ? props.customer.name : '',
      phone: props.mode === 'edit' ? (props.customer.phone ?? '') : '',
      address: props.mode === 'edit' ? (props.customer.address ?? '') : '',
      notes: props.mode === 'edit' ? (props.customer.notes ?? '') : '',
    },
  });

  const onSubmit = async (values: CustomerFormOutput) => {
    const name = values.name.trim();
    const phone = values.phone?.trim() ?? '';
    const address = values.address?.trim() ?? '';
    const notes = values.notes?.trim() ?? '';
    try {
      if (props.mode === 'create') {
        await create.mutateAsync({
          name,
          ...(phone ? { phone } : {}),
          ...(address ? { address } : {}),
          ...(notes ? { notes } : {}),
        } satisfies CreateCustomerInput);
      } else {
        const input: UpdateCustomerInput = { name };
        if (dirtyFields.phone) input.phone = phone || null;
        if (dirtyFields.address) input.address = address || null;
        if (dirtyFields.notes) input.notes = notes || null;
        await update.mutateAsync({ id: props.customer.id, input });
      }
      close();
    } catch (err) {
      const message = apiErrorMessage(err, 'Error desconocido');
      setError('root', { message });
    }
  };

  const title = props.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente';

  return (
    <Modal title={title} onClose={close} exiting={closing} initialFocusSelector="input">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-4">
        <Input
          {...register('name')}
          id={nameInputId}
          label="Nombre *"
          placeholder="Nombre del cliente…"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? nameErrorId : undefined}
        />

        {errors.name ? (
          <p id={nameErrorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
            {errors.name.message}
          </p>
        ) : null}

        <Input
          {...register('phone')}
          label="Teléfono"
          placeholder="612 345 678 (opcional)"
          aria-invalid={errors.phone ? true : undefined}
        />

        <Input
          {...register('address')}
          label="Dirección"
          placeholder="Calle, número, ciudad (opcional)"
          aria-invalid={errors.address ? true : undefined}
        />

        <Textarea
          {...register('notes')}
          label="Notas"
          placeholder="Cómo paga, cuándo vuelve, lo que quieras recordar (opcional)"
          error={errors.notes?.message}
        />

        {errors.root ? (
          <p className={cn(errorAlertClass, 'px-3 py-2')} role="alert">
            {errors.root.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting || create.isPending || update.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
