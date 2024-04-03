const https = require('https');
const { createObjectCsvWriter } = require('csv-writer');
const shopifyStoreDomain = 'https://shop.com/'; // assuming this is your Shopify store domain

const accessToken = 'shpat_********************************'; // Replace with your actual access token
const shopifyShopName = 'shop-name'; // Replace with your actual Shopify shop name

// Define GraphQL query to fetch products and their variants
const query = `
  query GetAllProducts($first: Int!, $after: String) {
    shop {
      name
    }
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          title
          handle
          variants(first: 250) {
            edges {
              node {
                id
                title
                sku
              }
            }
          }
        }
      }
    }
  }
`;

// Function to construct GraphQL request options
function constructRequestOptions(query, variables) {
  return {
    method: 'POST',
    hostname: `${shopifyShopName}.myshopify.com`,
    path: '/admin/api/2024-01/graphql.json',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  };
}

// Function to construct variant URLs
function constructVariantURL(handle, variantId) {
  return `${shopifyStoreDomain}/products/${handle}?variant=${variantId}`;
}

// Function to extract variant ID from URL
function extractVariantIdFromUrl(url) {
  const regex = /\/(\d+)$/; // Matches the last numeric part of the URL
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Function to fetch all products and their variants
const fetchAllProductsAndVariants = () => {
  const allProducts = [];

  const fetchProductsPage = (afterCursor) => {
    const reqOptions = constructRequestOptions(query, { first: 250, after: afterCursor });

    const req = https.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseData = JSON.parse(data);
        const products = responseData.data.products.edges;

        // Add products to allProducts array
        allProducts.push(...products);

        // If there are more pages, fetch the next page
        if (responseData.data.products.pageInfo.hasNextPage) {
          fetchProductsPage(responseData.data.products.pageInfo.endCursor);
        } else {
          // Once all pages have been fetched, write products to CSV
          writeProductsToCsv(allProducts);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error fetching products:', error);
    });

    req.write(JSON.stringify({ query, variables: { first: 250, after: afterCursor } }));
    req.end();
  };

  fetchProductsPage(null); // Start fetching the first page
};

// Function to write products and their variants to CSV
const writeProductsToCsv = (products) => {
  // Define CSV writer
  const csvWriter = createObjectCsvWriter({
    path: 'product_variant_url_data.csv',
    header: [
      { id: 'title', title: 'Product Title' },
      { id: 'handle', title: 'Product Handle' },
      { id: 'variantTitle', title: 'Variant Title' },
      { id: 'variantId', title: 'Variant ID' },
      { id: 'sku', title: 'SKU' },
      { id: 'url', title: 'URL' }
    ]
  });

  const records = [];

  // Iterate over products and their variants
  products.forEach(product => {
    const productTitle = product.node.title;
    const productHandle = product.node.handle;
    product.node.variants.edges.forEach(variant => {
      const variantId = extractVariantIdFromUrl(variant.node.id);
      const variantTitle = variant.node.title;
      const variantSku = variant.node.sku;
      const variantUrl = constructVariantURL(productHandle, variantId);
      records.push({ title: productTitle, handle: productHandle, variantTitle, variantId, sku: variantSku, url: variantUrl });
    });
  });

  // Write records to CSV
  csvWriter.writeRecords(records)
    .then(() => console.log('CSV file written successfully'))
    .catch(error => console.error('Error writing CSV:', error));
};

// Execute the function to fetch all products and their variants
fetchAllProductsAndVariants();
