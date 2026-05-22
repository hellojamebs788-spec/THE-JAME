const SUPABASE_URL = "https://afkjxrzuvuxxjtjypzcq.supabase.co";

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFma2p4cnp1dnV4eGp0anlwemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MjgwMDMsImV4cCI6MjA5NTAwNDAwM30.9o0J3QdU6Oo6VA8WyUIRCho9MZWlxtO6QmLukeCpKvY";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let transactions = [];

async function loadTransactions() {

  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  transactions = data;

  renderTransactions();
}

function renderTransactions() {

  const list = document.getElementById("transactionList");

  list.innerHTML = "";

  let income = 0;
  let expense = 0;
  let debt = 0;

  transactions.forEach((item) => {

    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${item.title}</strong><br><br>

      ประเภท: ${item.type}<br>
      จำนวน: ${Number(item.amount).toLocaleString()} บาท<br>
      หมวดหมู่: ${item.category || "-"}<br>
      หมายเหตุ: ${item.note || "-"}<br>
      วันที่: ${new Date(item.created_at).toLocaleString("th-TH")}<br>

      <button class="delete-btn"
        onclick="deleteTransaction('${item.id}')">
        ลบรายการ
      </button>
    `;

    list.appendChild(li);

    if (item.type === "income") {
      income += Number(item.amount);
    }

    if (item.type === "expense") {
      expense += Number(item.amount);
    }

    if (item.type === "debt") {
      debt += Number(item.amount);
    }

  });

  document.getElementById("totalIncome").innerText =
    income.toLocaleString() + " บาท";

  document.getElementById("totalExpense").innerText =
    expense.toLocaleString() + " บาท";

  document.getElementById("totalDebt").innerText =
    debt.toLocaleString() + " บาท";

  document.getElementById("balance").innerText =
    (income - expense - debt).toLocaleString() + " บาท";
}

async function addTransaction() {

  const title = document.getElementById("title").value;
  const amount = document.getElementById("amount").value;
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;
  const note = document.getElementById("note").value;

  if (!title || !amount) {
    alert("กรอกข้อมูลให้ครบ");
    return;
  }

  const { error } = await supabaseClient
    .from("transactions")
    .insert([
      {
        title: title,
        amount: amount,
        type: type,
        category: category,
        note: note
      }
    ]);

  if (error) {
    console.error(error);
    alert("เกิดข้อผิดพลาด");
    return;
  }

  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("category").value = "";
  document.getElementById("note").value = "";

  loadTransactions();
}

async function deleteTransaction(id) {

  const confirmDelete = confirm("ต้องการลบรายการนี้ ?");

  if (!confirmDelete) return;

  const { error } = await supabaseClient
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  loadTransactions();
}

async function readSlip() {

  const fileInput = document.getElementById("slipInput");

  if (!fileInput.files[0]) {
    alert("กรุณาเลือกสลิป");
    return;
  }

  document.getElementById("ocrResult").innerText =
    "กำลังอ่านสลิป...";

  const {
    data: { text }
  } = await Tesseract.recognize(
    fileInput.files[0],
    "eng+tha"
  );

  document.getElementById("ocrResult").innerText = text;

  const amountMatch = text.match(/\d+[\.,]?\d*/);

  if (amountMatch) {
    document.getElementById("amount").value =
      amountMatch[0].replace(",", "");
  }
}

loadTransactions();
