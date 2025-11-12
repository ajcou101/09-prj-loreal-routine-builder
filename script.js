/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineBtn = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");
const clearAllBtn = document.getElementById("clearAllBtn");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Track selected products */
let selectedProducts =
  JSON.parse(localStorage.getItem("selectedProducts")) || [];

/* Function to save selected products to localStorage */
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

/* Track conversation history for chat */
let conversationHistory = [];

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");

  /* Add click event listeners to product cards */
  const productCards = document.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    card.addEventListener("click", () => toggleProductSelection(card));
  });

  /* Highlight selected products */
  selectedProducts.forEach((id) => {
    const card = document.querySelector(`.product-card[data-id="${id}"]`);
    if (card) card.classList.add("selected");
  });
}

/* Update the Selected Products section */
function updateSelectedProductsList(products) {
  const selectedProductsList = document.getElementById("selectedProductsList");
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class='placeholder-message'>No products selected.</p>`;
  } else {
    selectedProductsList.innerHTML = selectedProducts
      .map((id) => {
        const product = products.find((p) => p.id === id);
        return `
          <div class="selected-product-box" data-id="${product.id}">
            <span class="product-title">${product.name}</span>
            <button class="remove-btn">Remove</button>
          </div>
        `;
      })
      .join("");
  }

  /* Add click event listeners to remove buttons */
  const removeButtons = document.querySelectorAll(".remove-btn");
  removeButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the card click event
      const productId = button.parentElement.getAttribute("data-id");
      removeProduct(productId, products);
    });
  });
}

/* Function to append messages to the chat window */
function appendMessage(role, content) {
  const messageDiv = document.createElement("div");
  messageDiv.className = role === "user" ? "user-message" : "ai-message";
  messageDiv.innerHTML = content;
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Remove product from selection */
function removeProduct(productId, products) {
  const id = parseInt(productId);
  selectedProducts = selectedProducts.filter((i) => i !== id);
  const productCard = document.querySelector(`.product-card[data-id="${id}"]`);
  if (productCard) productCard.classList.remove("selected");
  saveSelectedProducts();
  updateSelectedProductsList(products);
}

/* Toggle product selection */
function toggleProductSelection(card) {
  const productId = parseInt(card.getAttribute("data-id"));

  if (selectedProducts.includes(productId)) {
    // Remove product from selection
    selectedProducts = selectedProducts.filter((id) => id !== productId);
    card.classList.remove("selected");
  } else {
    // Add product to selection
    selectedProducts.push(productId);
    card.classList.add("selected");
  }

  saveSelectedProducts();
  loadProducts().then((products) => updateSelectedProductsList(products));
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Chat form submission handler for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  // Display user message in chat
  appendMessage("user", userMessage);

  // Add user message to conversation history
  conversationHistory.push({ role: "user", content: userMessage });

  // Clear the input field
  userInput.value = "";

  try {
    // Send the conversation history to the OpenAI API via Cloudflare Worker
    const response = await fetch(
      "https://loreal-worker.dark-gate5480.workers.dev/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversationHistory,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Add AI response to conversation history
    conversationHistory.push({ role: "assistant", content: aiResponse });

    // Display AI response in chat
    appendMessage("assistant", aiResponse);
  } catch (error) {
    // Display error message in chat
    appendMessage("assistant", `Error: ${error.message}`);
  }
});

/* Generate Routine button handler */
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    appendMessage("assistant", "Please select some products first.");
    return;
  }

  // Collect selected product data
  const products = await loadProducts();
  const selectedProductData = selectedProducts.map((id) => {
    const product = products.find((p) => p.id === id);
    return {
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    };
  });

  // Prepare the prompt for OpenAI
  const prompt = `Generate a personalized skincare routine based on these selected products: ${JSON.stringify(
    selectedProductData
  )}. Provide a step-by-step routine, including when to use each product (morning, evening, etc.), and any tips.`;

  try {
    // Send request to Cloudflare Worker (replace with your actual worker URL)
    const response = await fetch(
      "https://loreal-worker.dark-gate5480.workers.dev/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Display the AI-generated routine in the chat window
    const aiResponse = data.choices[0].message.content;
    appendMessage("assistant", aiResponse);
    // Add to conversation history
    conversationHistory.push({ role: "user", content: prompt });
    conversationHistory.push({ role: "assistant", content: aiResponse });
  } catch (error) {
    appendMessage("assistant", `Error generating routine: ${error.message}`);
  }
});

/* Clear All button handler */
clearAllBtn.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  // Remove selected class from all product cards
  document
    .querySelectorAll(".product-card.selected")
    .forEach((card) => card.classList.remove("selected"));
  loadProducts().then((products) => updateSelectedProductsList(products));
});

/* Initialize the page */
document.addEventListener("DOMContentLoaded", () => {
  loadProducts().then((products) => updateSelectedProductsList(products));
});
