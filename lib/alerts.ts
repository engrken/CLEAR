// lib/alerts.ts
import Swal from 'sweetalert2';

export const ThemedAlert = Swal.mixin({
  background: '#212529', // Matches your bg-card dark theme
  color: '#f8f9fa',      // Matches your text-color
  customClass: {
    popup: 'border border-secondary rounded shadow-lg',
    confirmButton: 'btn btn-info fw-bold text-dark ms-2',
    cancelButton: 'btn btn-secondary me-2',
    input: 'form-control bg-dark text-white border-secondary mt-3'
  },
  buttonsStyling: false, // Forces Swal to use your Bootstrap button classes above
  reverseButtons: true   // Puts 'Cancel' on the left, 'Confirm' on the right
});