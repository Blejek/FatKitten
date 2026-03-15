
const offApiUrl = 'https://world.openfoodfacts.net/api/v2/product/';


const EATEN_STORAGE_KEY = 'zjedzone_potrawy';
const MEALS_STORAGE_KEY = 'moje_potrawy';



class FoodScannerAdder{
    constructor(ctx){
        this.ctx = document.getElementById(ctx);
        this.name = ctx;

        this.ctx.insertAdjacentHTML("beforeend", `
            <div id="${ctx}-reader" style="width: 500px"></div>

            <section id="${ctx}-table"></section>
            <img src="" alt="Brak obrazu produktu" id="${ctx}-image">

            <form id="${ctx}-food-adder">
                <label for="${ctx}-food-count">Ilość (g):</label>
                <input type="number" id="${ctx}-food-count" name="${ctx}-food-count" min="0" step="1" required>

                <input type="reset" value="X">
                <input type="submit" value="Dodaj produkt">
            </form>
        `);

        this.form = null
        this.currentProductData = null;

        this.scannerReader = `${ctx}-reader`;
        this.scannerSize = {width: 250, height: 250};
        this.scanner = null;

        this.table = null;
        this.image = null;

        this.hide()
    }

    show(cb){
        this.cb = cb;
        this.ctx.style.display = "block";

        this.form = document.getElementById(`${this.name}-food-adder`);
        this.currentProductData = null;

        this.table = document.getElementById(`${this.name}-table`);
        this.image = document.getElementById(`${this.name}-image`);

        this.form.addEventListener("submit", (ev) => {
            ev.preventDefault();

            const weight = parseFloat(ev.target[`${this.name}-food-count`].value) || 0;
            let nut = this.currentProductData.nutrients;

            const calories = nut["energy-kcal_100g"] || 0;
            const carbs = nut["carbohydrates_100g"] || 0;
            const sugars = nut["sugars_100g"] || 0;
            const fats = nut["fat_100g"] || 0;
            const proteins = nut["proteins_100g"] || 0;

            this.cb(this, { name: this.currentProductData.name, energy: calories, protein: proteins, carbs: carbs, sugars: sugars, fats: fats, quantity: weight})
        });

        this.form.addEventListener("reset", (ev) => {
            ev.preventDefault();
            this.hide();
        });

        this.scanner = new Html5QrcodeScanner(
            this.scannerReader,
            { fps: 20, qrbox: this.scannerSize }, 
            false
        );
            
        this.scanner.render(
        (decodedText, decodedResult) => {
            console.log(`Code matched = ${decodedText}`, decodedResult);
            this.getProductData(decodedText);
        }, 
        (error) => {

        });
        console.log(this.scanner);
    }

    hide(){
        this.ctx.style.display = "none";
        if (this.table) {
            this.table.innerHTML = "";
        }
        if (this.image) {
            this.image.src = "";
            this.image.alt = "Brak";
        }
        this.currentProductData = null;
        if(this.scanner) {
            this.scanner.clear();
        }
        this.scanner = null;
        this.cb = null;
    }

    
    onScanFailure(error) {

    }

    getNutriDescription(score) {
        const desc = {
            'A': "Produkt o bardzo wysokiej jakości odżywczej. Bardzo zdrowy wybór.",
            'B': "Produkt o dobrej jakości odżywczej. Zdrowy wybór.",
            'C': "Produkt o umiarkowanej jakości odżywczej. Spożywaj z rozwagą.",
            'D': "Produkt o niskiej jakości odżywczej. Ograniczaj spożycie.",
            'E': "Produkt o bardzo niskiej jakości odżywczej. Unikaj częstego spożywania."
        };
        return desc[score] || "Brak szczegółowej analizy zdrowotnej.";
    }
    
    getProductData(barcode) {
        const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {

            if (data.status === 0) {
                this.table.innerHTML = "<p>Nie znaleziono produktu w bazie Open Food Facts.</p>";
                return;
            }

            if(data.product.image_url) {
                this.image.src = data.product.image_url;
                this.image.alt = data.product.product_name || "Zdjęcie produktu";
            } 
            else {
                this.image.alt = "Brak obrazu produktu";
            }

            const product = data.product;
            const nutrients = product.nutriments;
            const servingSize = product.serving_size; // np. "250 g"
            const productWeight = product.quantity || "Nie podano"; // Waga/ilość produktu (np. "500g")

            // Przygotowanie tabeli
            let tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>Składnik odżywczy</th>
                            <th>na 100g/ml</th>
                            ${servingSize ? `<th>Na porcję (${servingSize})</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Lista makroskładników do wyświetlenia
            const rows = [
                { label: "Energia (kcal)", key: "energy-kcal" },
                { label: "Tłuszcz (g)", key: "fat" },
                { label: "Kwasy tłuszczowe nasycone (g)", key: "saturated-fat" },
                { label: "Węglowodany (g)", key: "carbohydrates" },
                { label: "Cukry (g)", key: "sugars" },
                { label: "Białko (g)", key: "proteins" },
                { label: "Sól (g)", key: "salt" }
            ];

            rows.forEach(row => {
                const val100 = nutrients[`${row.key}_100g`];
                const valServing = nutrients[`${row.key}_serving`];

                if (val100 !== undefined) {
                    tableHtml += `
                        <tr>
                            <td>${row.label}</td>
                            <td>${val100}</td>
                            ${servingSize ? `<td>${valServing || '-'}</td>` : ''}
                        </tr>
                    `;
                }
            });

            tableHtml += `</tbody></table>`;

            // Przygotowanie opisu zdrowotnego (Nutri-Score i Nova)
            const nutriScore = product.nutriscore_grade ? product.nutriscore_grade.toUpperCase() : "Brak danych";
            const novaGroup = product.nova_group ? `Grupa NOVA: ${product.nova_group}` : "";
            const healthDesc = `
                <p>
                    <strong>Nazwa:</strong> ${product.product_name || "Brak danych"}<br>
                    <strong>Waga netto:</strong> ${productWeight}<br>
                    <strong>Ocena zdrowotna:</strong> Nutri-Score ${nutriScore}${novaGroup}.<br>
                    <em>${this.getNutriDescription(nutriScore)}</em>
                </p>
            `;

            // Wstawienie do elementu #table
            this.table.innerHTML = tableHtml + healthDesc;

            // Zapisanie aktualnych danych produktu do zmiennej globalnej
            this.currentProductData = {
                name: product.product_name || "Brak danych",
                quantity: productWeight,
                nutriScore: nutriScore,
                novaGroup: novaGroup,
                nutrients: nutrients
            };
        })
        .catch (error => {
            console.error("Błąd podczas pobierania danych:", error);
            this.table.innerHTML = "<p>Wystąpił błąd połączenia z bazą danych.</p>";
            this.currentProductData = null;
        });
    }
}

let scanner = new FoodScannerAdder("scanner");










class MealAdder{
    constructor(ctx, foodScanner, mealsKey){
        this.ctx = document.getElementById(ctx);
        this.name = ctx;
        this.foodScanner = foodScanner;
        this.mealsKey = mealsKey;

        this.ctx.insertAdjacentHTML("beforeend", `
            <div style="border: 1px solid #ccc; padding: 20px; margin-top: 20px; background: #f9f9f9;">
                <h3>Kreator Posiłku</h3>
                <div style="margin-bottom: 15px;">
                    <label><strong>Nazwa posiłku:</strong></label>
                    <input type="text" id="${this.name}-mealName" placeholder="np. Owsianka z owocami" style="width: 100%; padding: 5px;" required>
                </div>
                
                <table style="width: 100%; text-align: left; border-collapse: collapse; margin-bottom: 15px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #ddd;">
                            <th>Składnik</th>
                            <th>Kcal (na 100g)</th>
                            <th>Białko (g)</th>
                            <th>Węglo. (g)</th>
                            <th>Tłuszcz (g)</th>
                            <th>Ilość (g)</th>
                            <th>Akcja</th>
                        </tr>
                    </thead>
                    <tbody id="${this.name}-tbody">
                        </tbody>
                </table>
                
                <input type="button" id="${this.name}-addBtn" style="margin-right: 10px;" value="+ Dodaj składnik">
                <input type="button" id="${this.name}-scanBtn" style="margin-right: 10px;" value="+ Skanuj składnik">
                <input type="submit" id="${this.name}-saveBtn" style="background: #4CAF50; color: white;" value="Zapisz Posiłek">
                <input type="reset" id="${this.name}-cancelBtn" style="background: #f44336; color: white;" value="Anuluj">
            </div>
        `);

        // Pobranie referencji do kluczowych elementów
        this.tbody = document.getElementById(`${this.name}-tbody`);
        this.mealNameInput = document.getElementById(`${this.name}-mealName`);

        // Podpięcie eventów do przycisków (używamy arrow functions, aby zachować kontekst 'this')
        document.getElementById(`${this.name}-addBtn`).addEventListener('click', () => this.addRow());
        document.getElementById(`${this.name}-scanBtn`).addEventListener('click', () => this.scanRow());
        document.getElementById(`${this.name}-saveBtn`).addEventListener('click', () => this.saveMeal());
        document.getElementById(`${this.name}-cancelBtn`).addEventListener('click', () => this.hide());

        // Zgodnie z poleceniem - wywołanie ukrycia w konstruktorze
        this.hide();
    }

    show(cb, reset = true){
        this.cb = cb;
        if(reset){
            this.mealNameInput.value = '';
            this.tbody.innerHTML = ''; 
            this.addRow();
        }
        this.ctx.style.display = 'block';
    }
    
    hide() {
        this.cb = null;
        this.ctx.style.display = 'none';
    }

    addRow(prod = null) {


        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        
        // Kod HTML pojedynczego wiersza

        if(prod != null){
            tr.innerHTML = `
                <td><input type="text" class="prod-name" placeholder="Nazwa" style="width: 90%;" value="${prod.name}" required></td>
                <td><input type="number" class="prod-energy" placeholder="0" min="0" step="1" style="width: 60px;" value="${prod.energy}" required></td>
                <td><input type="number" class="prod-protein" placeholder="0" min="0" step="0.1" style="width: 60px;" value="${prod.protein}" required></td>
                <td><input type="number" class="prod-carbs" placeholder="0" min="0" step="0.1" style="width: 60px;" value="${prod.carbs}" required></td>
                <td><input type="number" class="prod-fats" placeholder="0" min="0" step="0.1" style="width: 60px;" value="${prod.fats}" required></td>
                <td><input type="number" class="prod-qty" placeholder="0" min="1" step="1" style="width: 60px;" value="${prod.quantity}" required></td>
                <td><button type="button" class="remove-btn">Usuń</button></td>
            `;
        }
        else{
            tr.innerHTML = `
                <td><input type="text" class="prod-name" placeholder="Nazwa" style="width: 90%;" required></td>
                <td><input type="number" class="prod-energy" placeholder="0" min="0" step="1" style="width: 60px;" required></td>
                <td><input type="number" class="prod-protein" placeholder="0" min="0" step="0.1" style="width: 60px;" required></td>
                <td><input type="number" class="prod-carbs" placeholder="0" min="0" step="0.1" style="width: 60px;" required></td>
                <td><input type="number" class="prod-fats" placeholder="0" min="0" step="0.1" style="width: 60px;" required></td>
                <td><input type="number" class="prod-qty" placeholder="0" min="1" step="1" style="width: 60px;" required></td>
                <td><button type="button" class="remove-btn">Usuń</button></td>
            `;
        }


        // Podpięcie usuwania dla tego konkretnego wiersza
        tr.querySelector('.remove-btn').addEventListener('click', () => {
            tr.remove();
        });

        this.tbody.appendChild(tr);
    }

    scanRow(){
        this.hide();
        this.foodScanner.show((scanner, product) => {
            this.addRow(product);
            scanner.hide();
            this.show(this.cb, false);
        })

    }

    saveMeal() {
        const mealName = this.mealNameInput.value.trim();
        
        if (!mealName) {
            alert("Proszę podać nazwę posiłku!");
            return;
        }

        const rows = this.tbody.querySelectorAll('tr');
        if (rows.length === 0) {
            alert("Posiłek musi mieć co najmniej jeden składnik!");
            return;
        }

        const products = [];
        let validationFailed = false;

        // Pętla iterująca po wszystkich wierszach tabeli
        rows.forEach(row => {
            const name = row.querySelector('.prod-name').value.trim();
            const energy = parseFloat(row.querySelector('.prod-energy').value);
            const protein = parseFloat(row.querySelector('.prod-protein').value);
            const carbs = parseFloat(row.querySelector('.prod-carbs').value);
            const fats = parseFloat(row.querySelector('.prod-fats').value);
            const quantity = parseFloat(row.querySelector('.prod-qty').value);

            // Prosta walidacja czy wszystkie pola są wypełnione liczbami
            if (!name || isNaN(energy) || isNaN(protein) || isNaN(carbs) || isNaN(fats) || isNaN(quantity)) {
                validationFailed = true;
            } else {
                products.push({ name, energy, protein, carbs, fats, quantity });
            }
        });

        if (validationFailed) {
            alert("Upewnij się, że wszystkie pola składników są poprawnie wypełnione!");
            return;
        }

        if(this.cb) this.cb(mealName, products);
        this.createMeal(mealName, products);
        this.hide();
    }

    
    getMeals() {
        const mealsJSON = localStorage.getItem(this.mealsKey);
        return mealsJSON ? JSON.parse(mealsJSON) : [];
    }

    createMeal(name, products) {
        const meals = this.getMeals();
        
        const newMeal = {
            id: Date.now().toString(), // Prosty unikalny ID
            name: name,
            products: products
        };

        meals.push(newMeal);
        localStorage.setItem(this.mealsKey, JSON.stringify(meals));
        console.log(`Potrawa "${name}" została zapisana!`);
    }


    deleteMeal(id) {
        let meals = this.getMeals();
        meals = meals.filter(meal => meal.id !== id);
        localStorage.setItem(this.mealsKey, JSON.stringify(meals));
    }

    // Prosta funkcja edytująca (tutaj zmieniamy tylko nazwę dla uproszczenia)
    editMeal(id) {
        const meals = this.getMeals();
        const mealIndex = meals.findIndex(meal => meal.id === id);
        
        if (mealIndex > -1) {
            const newName = prompt("Podaj nową nazwę potrawy:", meals[mealIndex].name);
            
            if (newName && newName.trim() !== "") {
                meals[mealIndex].name = newName.trim();
                localStorage.setItem(this.mealsKey, JSON.stringify(meals));
            }
        }
    }
}


let mealAdder = new MealAdder("meal-creator", scanner, MEALS_STORAGE_KEY);



















class MealEater {
    constructor(ctx, foodScanner, mealAdder, eatenKey, mealsKey) {
        this.ctx = document.getElementById(ctx);
        this.name = ctx;
        this.storageKey = eatenKey;
        this.mealsStorageKey = mealsKey;
        this.foodScanner = foodScanner;
        this.mealAdder = mealAdder;

        // Inicjalizacja lub pobranie danych o spożyciu
        this.eatenData = this.getEatenData();

        // Wstrzyknięcie struktury HTML
        this.ctx.innerHTML = `
            <div style="border: 1px solid #ccc; padding: 20px; margin-top: 20px; background: #f0f8ff;">
                <h3>Panel Spożycia</h3>
                
                <div style="background: #fff; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #ddd;">
                    <h4 style="margin-top: 0;">Dzisiejsze Makro:</h4>
                    <p style="font-size: 1.2em; margin: 5px 0;">
                        🔥 Kcal: <strong id="${this.name}-kcal">0</strong> | 
                        🥩 Białko: <strong id="${this.name}-protein">0</strong>g | 
                        🍞 Węgle: <strong id="${this.name}-carbs">0</strong>g | 
                        🥑 Tłuszcze: <strong id="${this.name}-fats">0</strong>g
                    </p>
                    
                    <div style="margin-top: 15px; display: flex; gap: 10px; align-items: center;">
                        <input type="button" id="${this.name}-resetBtn" style="background: #ff9800; color: white; padding: 5px 10px;" value="Zresetuj teraz">
                        <label>Automatyczny reset:</label>
                        <select id="${this.name}-cycleSelect">
                            <option value="manual">Tylko ręcznie</option>
                            <option value="daily">Codziennie (północ)</option>
                            <option value="weekly">Co tydzień (poniedziałek)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <h4>Wybierz posiłek do zjedzenia:</h4>
                    <input type="text" id="${this.name}-searchInput" placeholder="Szukaj potrawy..." style="width: 100%; padding: 8px; margin-bottom: 10px;">
                    
                    <ul id="${this.name}-mealList" style="list-style-type: none; padding: 0; max-height: 250px; overflow-y: auto; border: 1px solid #eee;">
                    </ul>
                </div>
                
                <section>
                    <input type="button" id="${this.name}-addMeal" value="Dodaj posiłek">
                    <input type="button" id="${this.name}-scanMeal" value="Skanuj posiłek">
                </section>
            </div>
        `;

        // Referencje do elementów DOM
        this.kcalEl = document.getElementById(`${this.name}-kcal`);
        this.proteinEl = document.getElementById(`${this.name}-protein`);
        this.carbsEl = document.getElementById(`${this.name}-carbs`);
        this.fatsEl = document.getElementById(`${this.name}-fats`);
        this.searchInput = document.getElementById(`${this.name}-searchInput`);
        this.mealListEl = document.getElementById(`${this.name}-mealList`);
        this.cycleSelect = document.getElementById(`${this.name}-cycleSelect`);

        // Podpięcie eventów
        document.getElementById(`${this.name}-resetBtn`).addEventListener('click', () => this.resetStats());
        
        document.getElementById(`${this.name}-addMeal`).addEventListener('click', () => {
            this.hide();
            this.mealAdder.show((meal, products) => {
                this.show();
            })
        });

        document.getElementById(`${this.name}-scanMeal`).addEventListener('click', () => {
            this.hide();
            this.foodScanner.show((scanner, product) => {
                scanner.hide();
                this.show();
                this.eat(product, product.quantity);
            })
        });

        this.searchInput.addEventListener('input', (e) => this.renderMealList(e.target.value));
        
        this.cycleSelect.value = this.eatenData.cycle;
        this.cycleSelect.addEventListener('change', (e) => {
            this.eatenData.cycle = e.target.value;
            this.saveData();
        });

        this.hide();
    }

    // --- METODY GŁÓWNE ---

    hide() {
        this.ctx.style.display = 'none';
    }

    show() {
        this.checkCyclicReset(); // Sprawdza, czy minął dzień/tydzień przed pokazaniem danych
        this.updateStatsUI();
        this.searchInput.value = '';
        this.renderMealList(); // Renderuje pełną listę na start
        this.ctx.style.display = 'block';
    }

    // --- LOGIKA DANYCH I RESETU ---

    getEatenData() {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
            return JSON.parse(data);
        }
        return {
            energy: 0, protein: 0, carbs: 0, fats: 0,
            lastReset: Date.now(),
            cycle: 'daily' // Domyślnie codziennie
        };
    }

    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.eatenData));
    }

    resetStats() {
        this.eatenData.energy = 0;
        this.eatenData.protein = 0;
        this.eatenData.carbs = 0;
        this.eatenData.fats = 0;
        this.eatenData.lastReset = Date.now();
        this.saveData();
        this.updateStatsUI();
        console.log("Zresetowano spożyte makroskładniki.");
    }

    checkCyclicReset() {
        if (this.eatenData.cycle === 'manual') return;

        const now = new Date();
        const last = new Date(this.eatenData.lastReset);

        if (this.eatenData.cycle === 'daily') {
            // Jeśli to inny dzień miesiąca/roku
            if (now.toDateString() !== last.toDateString()) {
                this.resetStats();
            }
        } else if (this.eatenData.cycle === 'weekly') {
            // Proste sprawdzanie tygodnia (reset, jeśli minęło 7 dni, lub przeszedł poniedziałek)
            const daysPassed = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            const isNewWeek = now.getDay() === 1 && last.getDay() !== 1 && daysPassed >= 1; 
            
            if (daysPassed >= 7 || isNewWeek) {
                this.resetStats();
            }
        }
    }

    // --- INTERFEJS UŻYTKOWNIKA ---

    updateStatsUI() {
        this.kcalEl.textContent = this.eatenData.energy.toFixed(0);
        this.proteinEl.textContent = this.eatenData.protein.toFixed(1);
        this.carbsEl.textContent = this.eatenData.carbs.toFixed(1);
        this.fatsEl.textContent = this.eatenData.fats.toFixed(1);
    }

    renderMealList(filterText = '') {
        this.mealListEl.innerHTML = '';
        
        // Pobiera potrawy z Local Storage (zapisane wcześniej przez MealAdder)
        const savedMealsStr = localStorage.getItem(this.mealsStorageKey);
        const meals = savedMealsStr ? JSON.parse(savedMealsStr) : [];

        if (meals.length === 0) {
            this.mealListEl.innerHTML = '<li style="padding: 10px;">Brak potraw. Stwórz je najpierw!</li>';
            return;
        }

        const lowerFilter = filterText.toLowerCase();

        meals.forEach(meal => {
            if (meal.name.toLowerCase().includes(lowerFilter)) {
                const li = document.createElement('li');
                li.style.padding = '10px';
                li.style.borderBottom = '1px solid #eee';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';

                // Obliczanie wartości potrawy (żeby wyświetlić je na liście)
                const mealTotals = this.calculateMealTotals(meal.products);

                li.innerHTML = `
                    <div>
                        <strong>${meal.name}</strong><br>
                        <small>${mealTotals.energy.toFixed(0)} kcal | B: ${mealTotals.protein.toFixed(1)}g</small>
                    </div>
                    <input type="button" style="background: #4CAF50; color: white; padding: 5px 10px;" value="Zjedz">
                `;

                // Podpięcie eventu pod przycisk "Zjedz"
                li.querySelector('input[type="button"]').addEventListener('click', () => {
                    const portionStr = prompt(`Podaj wielkość zjedzonej porcji w gramach:`, mealTotals.quantity);
                    
                    if (portionStr !== null) { // Sprawdza czy nie wciśnięto "Anuluj"
                        const portion = parseFloat(portionStr);
                        if (!isNaN(portion) && portion > 0) {
                            this.eat(mealTotals, portion);
                        } else {
                            alert("Podano nieprawidłową wagę.");
                        }
                    }
                });

                this.mealListEl.appendChild(li);
            }
        });
    }

    // --- LOGIKA JEDZENIA ---

    calculateMealTotals(products) {
        return products.reduce((totals, product) => {
            const factor = product.quantity / 100;
            return {
                energy: totals.energy + (product.energy * factor),
                protein: totals.protein + (product.protein * factor),
                carbs: totals.carbs + (product.carbs * factor),
                fats: totals.fats + (product.fats * factor),
                quantity: totals.quantity + parseFloat(product.quantity) // Dodano sumowanie wagi
            };
        }, { energy: 0, protein: 0, carbs: 0, fats: 0, quantity: 0 });
    }

    eat(mealTotals, eatenWeight) {
        // Obliczamy proporcję: ile zjedzono w stosunku do bazowej wagi posiłku
        const factor = eatenWeight / mealTotals.quantity;

        // Dodawanie przeliczonych makro do ogólnej puli
        this.eatenData.energy += mealTotals.energy * factor;
        this.eatenData.protein += mealTotals.protein * factor;
        this.eatenData.carbs += mealTotals.carbs * factor;
        this.eatenData.fats += mealTotals.fats * factor;
        
        this.saveData();
        this.updateStatsUI();
        
        // Mały efekt wizualny potwierdzający dodanie
        this.ctx.style.boxShadow = "0 0 10px #4CAF50";
        setTimeout(() => this.ctx.style.boxShadow = "none", 300);
    }
}


let mealEater = new MealEater("meal-eater", scanner, mealAdder, EATEN_STORAGE_KEY, MEALS_STORAGE_KEY)
mealEater.show()










