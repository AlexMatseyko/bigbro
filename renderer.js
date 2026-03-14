const authBlock = document.getElementById("auth");
const trackerBlock = document.getElementById("tracker");

const status = document.getElementById("status");

document.getElementById("login").onclick = () => {

const email = document.getElementById("email").value;

if(email){
authBlock.style.display = "none";
trackerBlock.style.display = "block";
}

};

document.getElementById("register").onclick = () => {
alert("Registration coming soon");
};

document.getElementById("startShift").onclick = () => {
status.innerText = "Online";
};

document.getElementById("pauseShift").onclick = () => {
status.innerText = "Pause";
};

document.getElementById("finishShift").onclick = () => {
status.innerText = "Offline";
};