const axios = require('axios');
const fs = require('fs');
const path = require('path');

const shopifyAdminApiUrl = 'https://shop.myshopify.com/admin/api/2024-01';

const logFilePath = path.join(__dirname, 'discount_code_log.txt');

const logToFile = (message) => {
  fs.appendFileSync(logFilePath, `${message}\n`);
};

const setDiscountCodesActive = async (apiKey, password, discountCodes) => {
  try {
    const updatedDiscountCodes = [];

    for (const discountCode of discountCodes) {
      // Fetch the price rule using the provided discount code
      const fetchDetailsMessage = `Fetching details for Discount Code "${discountCode}"`;
      console.log(fetchDetailsMessage);

      const response = await axios.get(
        `${shopifyAdminApiUrl}/price_rules.json?title=${encodeURIComponent(discountCode)}`,
        {
          auth: {
            username: apiKey,
            password: password,
          },
        }
      );

      const priceRules = response.data.price_rules;

      if (priceRules.length > 0) {
        const priceRuleId = priceRules[0].id;

        // Update the status (ends_at) of the price rule to make it active
        const updateMessage = `Updating Discount Code "${discountCode}" status to active`;

        const updateResponse = await axios.put(
          `${shopifyAdminApiUrl}/price_rules/${priceRuleId}.json`,
          {
            price_rule: {
              ends_at: null, // Set ends_at to null to make it active
            },
          },
          {
            auth: {
              username: apiKey,
              password: password,
            },
          }
        );

        updatedDiscountCodes.push({
          discountCode: discountCode,
          status: 'active',
        });

        const updateSuccessMessage = `Updating Discount Code "${discountCode}" status to active`;
        console.log(updateSuccessMessage);
        logToFile(updateSuccessMessage);
      } else {
        updatedDiscountCodes.push({
          discountCode: discountCode,
          status: 'not found',
        });

        const notFoundMessage = `Discount Code "${discountCode}" not found.`;
        console.error(notFoundMessage);
        logToFile(notFoundMessage);
      }
    }

    if (updatedDiscountCodes.length > 0) {
      const updatedDiscountCodesMessage = 'Updated Discount Codes:\n' +
        JSON.stringify(updatedDiscountCodes, null, 2);
      console.log(updatedDiscountCodesMessage);
    } else {
      const noUpdatesMessage = 'No discount codes updated.';
      console.error(noUpdatesMessage);
      logToFile(noUpdatesMessage);
    }

    return updatedDiscountCodes;
  } catch (error) {
    const errorMessage = `Error setting discount code statuses to active: ${error.message}`;
    console.error(errorMessage);
    logToFile(errorMessage);
    return null;
  }
};

// Replace with your Shopify API credentials and an array of discount codes
const apiKey = 'YOUR_API_KEY';
const password = 'shpat_********************************';

// Add Discount code in array which are deactivated
const discountCodes = ['DISCOUNT_CODE_1', 'DISCOUNT_CODE_2'];

setDiscountCodesActive(apiKey, password, discountCodes);
