const WHATSAPP_NUMBER="5585981033964";
function submitContactForm(e){
  e.preventDefault();
  const name = document.getElementById('cName').value;
  const email = document.getElementById('cEmail').value;
  const message = document.getElementById('cMessage').value;
  const text = encodeURIComponent(`Olá, meu nome é ${name} (${email}).\n\n${message}`);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  showToast('Mensagem preparada! Envie pelo WhatsApp.');
  document.getElementById('contactForm').reset();
}

function initWhatsappLinks(){
  const baseMsg = encodeURIComponent("Olá! Vim pelo site da Horizon Wear e gostaria de mais informações.");
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${baseMsg}`;
  document.getElementById('waContactBtn').href = waUrl;
  document.getElementById('waFooterLink').href = waUrl;
  document.getElementById('waSocialLink').href = waUrl;
  document.getElementById('waPolicyLink').href = waUrl;

  const paymentMsg = encodeURIComponent("Olá! Gostaria de saber quais são as formas de pagamento aceitas na Horizon Wear.");
  document.getElementById('waFormasPagamentoLink').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${paymentMsg}`;
}


initWhatsappLinks();