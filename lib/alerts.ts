// lib/alerts.ts
import Swal from 'sweetalert2';

export const ThemedAlert = Swal.mixin({
  background: 'var(--bs-body-bg, #212529)', // Adaptive background theme variable
  color: 'var(--bs-body-color, #f8f9fa)',     // Adaptive text color theme variable
  customClass: {
    popup: 'border border-secondary rounded shadow-lg',
    confirmButton: 'btn btn-info fw-bold text-dark ms-2',
    cancelButton: 'btn btn-secondary me-2',
    input: 'form-control bg-body text-color border-secondary mt-3'
  },
  buttonsStyling: false, // Forces Swal to use your Bootstrap button classes above
  reverseButtons: true   // Puts 'Cancel' on the left, 'Confirm' on the right
});