// frontend/app.js
const ws = new WebSocket(`ws://${location.host}/ws`);
 
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "clock") {
    document.getElementById("clock").textContent = data.value;
  }
};
 
ws.onclose = () => {
  console.log("Connexion perdue, tentative de reconnexion dans 3s...");
  setTimeout(() => location.reload(), 3000);
};