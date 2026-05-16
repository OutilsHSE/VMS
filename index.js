
    function updateCounters() {
      const rows = document.querySelectorAll('#obs-table tbody tr');
      let cPP = 0, cCD = 0, cAD = 0;
      rows.forEach(r => {
        const type = r.querySelector('.type-select').value;
        if (type === 'PP') cPP++;
        if (type === 'CD') cCD++;
        if (type === 'AD') cAD++;
      });
      document.getElementById('count-PP').textContent = cPP;
      document.getElementById('count-CD').textContent = cCD;
      document.getElementById('count-AD').textContent = cAD;
    }
function addRow() {
  const tbody = document.querySelector('#obs-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="type-select" onchange="applyColor(this); updateCounters()">
        <option value="PP">PP 👍</option>
        <option value="CD">CD ⚠️</option>
        <option value="AD">AD 🚫</option>
      </select>
    </td>
    <td>
      <textarea class="description" placeholder="Description"></textarea>
      <div class="print-description"></div>
    </td>
    <td>
      <textarea class="description can-disable" placeholder="Action à mener"></textarea>
      <div class="print-description"></div>
    </td>
    <td><input type="text" class="can-disable" placeholder="Responsable"></td>
    <td><input type="date" class="can-disable"></td>
    <td>
      <select class="can-disable">
        <option>À planifier</option>
        <option>En cours</option>
        <option>Clôturée</option>
      </select>
    </td>
    <td class="no-print"><button class="remove-row" onclick="removeRow(this)">✖</button></td>
  `;
  tbody.appendChild(tr);

  // Applique la couleur selon le type sélectionné
  applyColor(tr.querySelector('.type-select'));
  updateCounters();

  // Redimensionne et synchronise toutes les zones de texte avec leur div correspondante
  const textareas = tr.querySelectorAll('textarea.description');
  textareas.forEach(textarea => {
    const printDiv = textarea.nextElementSibling;

    function autoResizeAndSync() {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
      printDiv.textContent = textarea.value;
    }

    textarea.addEventListener('input', autoResizeAndSync);
    autoResizeAndSync(); // appel initial
  });
}
    function removeRow(btn) {
      btn.closest('tr').remove();
      updateCounters();
    }
    function toggleInputs(selectElement) {
      const tr = selectElement.closest('tr');
      const inputs = tr.querySelectorAll('.can-disable');
      if (selectElement.value === 'PP') {
        inputs.forEach(input => input.setAttribute('disabled', 'disabled'));
      } else {
        inputs.forEach(input => input.removeAttribute('disabled'));
      }
    }
    document.addEventListener('DOMContentLoaded', function () {
      const selectElement = document.getElementById('mySelect');
      if (selectElement) {
        selectElement.addEventListener('change', function () {
          toggleInputs(this);
        });

        // Appel initial pour définir l'état des inputs en fonction de la valeur par défaut
        toggleInputs(selectElement);
      }
    });

    function applyColor(selectElement) {
      const tr = selectElement.closest('tr');
      if (selectElement.value === 'PP') {
        tr.style.backgroundColor = '#d4edda'; // Couleur pour PP
      } else if (selectElement.value === 'CD') {
        tr.style.backgroundColor = '#fff3cd'; // Couleur pour CD
      } else if (selectElement.value === 'AD') {
        tr.style.backgroundColor = '#f8d7da'; // Couleur pour AD
      } else {
        tr.style.backgroundColor = ''; // Réinitialiser la couleur
      }
      toggleInputs(tr.querySelector('.type-select'));
    }


    // Fonction pour ouvrir la modale
    function openModal(imageUrl) {
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');
      modal.style.display = 'block';
    }

    
    function openModalFho(imageUrl) {
      const modal = document.getElementById('imageFhoModal');
      modal.style.display = 'block';
    }

    // Fonction pour fermer la modale
    function closeModal() {
      const modal = document.getElementById('imageModal');
      modal.style.display = 'none';
    }
    
    function closeFhoModal() {
      const modal = document.getElementById('imageFhoModal');
      modal.style.display = 'none';
    }

    // Écouteur d'événement pour le bouton d'ouverture
    document.getElementById('openModalBtn').onclick = function () {
      openModal('regles.png');
    };
    
    document.getElementById('openModalFhoBtn').onclick = function () {
      openModalFho();
    };

    // Écouteur d'événement pour le bouton de fermeture
    document.getElementsByClassName('close')[0].onclick = function () {
      closeModal();
    };
    
    document.getElementsByClassName('close-fho')[0].onclick = function () {
      closeFhoModal();
    };    

    // Fermer la modale si l'utilisateur clique en dehors de l'image
    window.onclick = function (event) {
      const modal = document.getElementById('imageModal');
       const fhoModal = document.getElementById('imageFhoModal');
     if (event.target == modal) {
        closeModal();
      }
             if (event.target == fhoModal) {
        closeFhoModal();
      }
    };

    window.onload = function () {
      localStorage.clear();
      // Efface tout le sessionStorage
      sessionStorage.clear();
      window.addEventListener("load", () => {
        // Si tu veux aussi vider tous les inputs et textarea
        document.querySelectorAll("input, textarea").forEach(el => {
          el.value = "";
        });
      });
      addRow();
      document.getElementById('visite-date').valueAsDate = new Date();
    }

    function setupCanvas(canvasId) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      let painting = false;

      function startPosition(e) {
        painting = true;
        draw(e);
        e.preventDefault(); // Empêche le comportement par défaut
      }

      function endPosition(e) {
        painting = false;
        ctx.beginPath();
        e.preventDefault(); // Empêche le comportement par défaut
      }

      function draw(e) {
        if (!painting) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';

        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
          // Utiliser les coordonnées du premier touch point
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          // Utiliser les coordonnées de la souris
          clientX = e.clientX;
          clientY = e.clientY;
        }

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        e.preventDefault(); // Empêche le comportement par défaut
      }

      // Ajouter des écouteurs pour les événements de souris
      canvas.addEventListener('mousedown', startPosition);
      canvas.addEventListener('mouseup', endPosition);
      canvas.addEventListener('mouseout', endPosition);
      canvas.addEventListener('mousemove', draw);

      // Ajouter des écouteurs pour les événements tactiles
      canvas.addEventListener('touchstart', startPosition);
      canvas.addEventListener('touchend', endPosition);
      canvas.addEventListener('touchcancel', endPosition);
      canvas.addEventListener('touchmove', draw);
    }

    // Initialisation
    setupCanvas('drawingCanvas1');
    setupCanvas('drawingCanvas2');

    // Bouton pour effacer
    function clearCanvas(canvasId) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Initialisation
    setupCanvas('drawingCanvas1');
    setupCanvas('drawingCanvas2');

    // Bouton pour effacer
    function clearCanvas(canvasId) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
