// toggle eye icon for hide & see password

const togglePassword = document.querySelector('#togglePassword');
const password = document.querySelector('#password');

togglePassword.addEventListener('click', function () {
  const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
  password.setAttribute('type', type);
  this.classList.toggle("fa-eye");
  this.classList.toggle("fa-eye-slash");
});


// Generate captcha and validate 

let num1, num2;

function generateCaptcha() {
  num1 = Math.floor(Math.random() * 10);
  num2 = Math.floor(Math.random() * 10);
  document.querySelector(".captcha-question").textContent = `${num1} + ${num2} =`;
}

generateCaptcha();

document.querySelector(".refresh").addEventListener("click", function (e) {
  e.preventDefault();
  generateCaptcha();
});

document.querySelector("#loginForm").addEventListener("submit", function (e) {
  let answer = parseInt(document.querySelector(".captcha-answer").value);
  if (answer !== num1 + num2) {
    e.preventDefault();
    alert("Wrong captcha! Try again.");
    generateCaptcha();
    document.querySelector(".captcha-answer").value = "";
  }
});

// If username or password wrong
const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("error") === "1") {
    alert("Invalid username or password!");
  }