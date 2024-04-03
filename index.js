const axios = require('axios');
const fs = require('fs');
const xlsx = require('xlsx'); // Import the xlsx library

// Shopify API credentials
const SHOP_URL = 'YOUR_SHOP_NAME';
const API_KEY = 'YOUR_API_KEY';
const PASSWORD = 'YOUR_PASSWORD';

// Path to the log file
const logFilePath = 'log.txt';

// Function to append data to a log file
function appendToLogFile(data) {
    fs.appendFileSync(logFilePath, data + '\n', 'utf8');
}

// Function to update product status if it is in "draft" status
async function updateProductStatusIfDraft(productId) {
    const gid = productId;
    const lastSlashIndex = gid.lastIndexOf('/');
    const extractedProductId = gid.substring(lastSlashIndex + 1);
    try {
        await axios.put(`https://${API_KEY}:${PASSWORD}@${SHOP_URL}/admin/api/2021-10/products/${extractedProductId}.json`, {
            product: {
                id: extractedProductId,
                status: 'active',
            },
        });
    } catch (error) {
        console.error(`Failed to update product status for product ID: ${extractedProductId}`, error);
    }
}

// Function to update price for variant
async function updatePriceForVariant(variantId, price) {
    try {
        await axios({
            method: 'post',
            url: `https://${SHOP_URL}/admin/api/2021-10/graphql.json`,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': PASSWORD
            },
            data: JSON.stringify({
                query: `
                mutation {
                    productVariantUpdate(input: {id: "${variantId}", price: "${price}"}) {
                        productVariant {
                            id
                            price
                        }
                    }
                }
                `
            })
        });
    } catch (error) {
        console.error('Failed to update price:', error);
    }
}

// Path to the Excel file containing SKU and prices
const excelFilePath = 'skuPriceSheet.xlsx';

// Function to read SKU and prices from Excel file
function readExcelData(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);
        return data.map(entry => ({
            sku: entry.SKU,
            price: parseFloat(entry[' price ']) // Use entry[' price '] to access the property with spaces
        }));
    } catch (error) {
        console.error('Error reading Excel data:', error);
        return [];
    }
}

// Function to update price for each variant
async function updateVariantPrices() {
    const skuAndPrices = readExcelData(excelFilePath);
    for (const { sku, price } of skuAndPrices) {
        // Function to find variant by SKU using GraphQL
        try {
            const query = `
        {
            productVariants(first: 1, query: "sku:${sku}") {
                edges {
                    node {
                        id
                        title
                        sku
                        price
                        product {
                            id
                            status
                        }
                    }
                }
            }
        }
        `;

            const response = await axios({
                method: 'post',
                url: `https://${SHOP_URL}/admin/api/2021-10/graphql.json`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': PASSWORD
                },
                data: JSON.stringify({ query })
            });

            const variants = response.data.data.productVariants.edges;
            if (variants.length > 0) {
                // Variant found, log its details
                const variant = variants[0].node;
                console.log(`Variant found - ID: ${variant.id}, Title: ${variant.title}, SKU: ${variant.sku}, Price: ${variant.price}`);
                appendToLogFile(`Variant found - ID: ${variant.id}, Title: ${variant.title}, SKU: ${variant.sku}, Price: ${variant.price}`);

                // Check if the product is in draft state
                if (variant.product && variant.product.status === 'DRAFT') {
                    // Product is in draft state, update to active
                    await updateProductStatusIfDraft(variant.product.id);
                    console.log(`Product activated for variant with SKU '${sku}'.`);
                    appendToLogFile(`Product activated for variant with SKU '${sku}'.`);
                }

                // Update the price
                await updatePriceForVariant(variant.id, price);
                console.log(`Price updated for variant with SKU '${sku}'. New price: ${price}`);
                appendToLogFile(`Price updated for variant with SKU '${sku}'. New price: ${price}`);
            } else {
                // Variant not found
                console.log(`Variant with SKU '${sku}' not found.`);
                appendToLogFile(`Variant with SKU '${sku}' not found.`);
            }
        } catch (error) {
            console.error('GraphQL request failed:', error);
        }

    }
}

// Call the function to find variant by SKU and update its price
updateVariantPrices();
