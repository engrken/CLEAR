'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { confirmCommittedChange, clearAlert } from '@/lib/clear-dialogs';

/** Confirmation before invoking an authorized Server Action for fee creation/deletion. */
export default function ConfirmedFeeActionForm({
  action, children, mode, description, className,
}: {
  action: (data: FormData) => Promise<void>;
  children: ReactNode;
  mode: 'create' | 'delete';
  description?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    const isPackage = formData.get('isPackage') === 'on';
    const feeName = String(formData.get('name') || '');
    const amount = String(formData.get('amount') || '');
    const target = mode === 'create'
      ? `${feeName} · ₱${amount} · ${formData.get('targetFund') || ''}`
      : description || 'Selected unused fee';
    const approved = await confirmCommittedChange({
      action: mode === 'delete' ? 'Delete this fee setup?' : 'Confirm new fee setup',
      target,
      consequence: mode === 'delete'
        ? 'This will permanently remove the unused fee configuration. Previously recorded payments and protected used fees cannot be removed.'
        : isPackage
          ? 'This fee is part of the mandatory package and can change enrolled students’ current-term clearance obligations. Validate its amount, period and target fund.'
          : 'This creates a standalone fee. Validate the amount, period and target fund before saving.',
      destructive: mode === 'delete' || isPackage,
      confirmText: mode === 'delete' ? 'Delete Fee' : 'Add Fee',
    });
    if (!approved) return;
    setPending(true);
    try {
      await action(formData);
      await clearAlert(mode === 'delete' ? 'Unused fee removed.' : 'Fee setup created.', 'success');
      router.refresh();
    } catch (err) {
      await clearAlert(err instanceof Error ? err.message : 'No fee changes were saved.', 'error');
    } finally { setPending(false); }
  };
  return <form onSubmit={(event) => void submit(event)} className={className}
    aria-busy={pending}>{children}</form>;
}
