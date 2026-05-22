let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

function saveData() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function updateUI() {
  const list = document.getElementById("transactionList");
  list.innerHTML = "";

  let income = 0;
  let expense = 0;
  let debt = 0;

  transactions.forEach((item, index) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${item.title}</strong><br>
      ${item.type} - ${item.amount} บาท
      <br><small>${item.date}</small>
      <br><button onclick="deleteTransaction(${index})">ลบ</button>
    `;

    list.appendChild(li);

    if (item.type === "income") income += item.amount;
    if (item.type === "expense") expense += item.amount;
    if (item.type === "debt") debt += item.amount;
  });

  document.getElementById("totalIncome").innerText = income + " บาท";
  document.getElementById("totalExpense").innerText = expense + " บาท";
  document.getElementById("totalDebt").innerText = debt + " บาท";
  document.getElementById("balance").innerText =
    income - expense - debt + " บาท";
}

function addTransaction() {
  const title = document.getElementById("title").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.getElementById("type").value;

  if (!title || !amount) {
    alert("กรอกข้อมูลให้ครบ");
    return;
  }

  transactions.push({
    title,
    amount,
    type,
    date: new Date().toLocaleString("th-TH")
  });

  saveData();
  updateUI();

  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";
}

function deleteTransaction(index) {
  transactions.splice(index, 1);
  saveData();
  updateUI();
}

async function readSlip() {
  const fileInput = document.getElementById("slipInput");

  if (!fileInput.files[0]) {
    alert("กรุณาเลือกไฟล์สลิป");
    return;
  }

  document.getElementById("ocrResult").innerText = "กำลังอ่านสลิป...";

  const { data: { text } } = await Tesseract.recognize(
    fileInput.files[0],
    "eng+tha"
  );

  document.getElementById("ocrResult").innerText = text;

  const moneyMatch = text.match(/\d+[\.,]?\d*/);

  if (moneyMatch) {
    document.getElementById("amount").value =
      moneyMatch[0].replace(",", "");
  }
}

updateUI();
