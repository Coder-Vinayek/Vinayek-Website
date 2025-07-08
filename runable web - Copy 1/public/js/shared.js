/*  public/js/shared.js
 *  Simple Bootstrap‑Toast helper you can call from anywhere:
 *      toast('Saved!', 'success');    // green
 *      toast('Oops',    'danger');    // red
 */

window.toast = (msg, type = 'info') => {
    // Build the toast HTML
    const html = `
      <div class="toast align-items-center text-bg-${type} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body">${msg}</div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`;
  
    // Insert into the toast container
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    document.getElementById('toasts').appendChild(wrap.firstElementChild);
  
    // Activate it
    new bootstrap.Toast(wrap.firstElementChild, { delay: 4000 }).show();
  };
  