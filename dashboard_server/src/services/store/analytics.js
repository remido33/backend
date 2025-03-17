const pool = require('../../helpers/db');
const executeQueryWithoutPool = require('../../helpers/executeQueryWithoutPool');
const { checkStoreExistsById, } = require('../../helpers/service_helpers');
const elastic = require('../../../../shared_utils/elastic');

const getChartAnalyticsService = async ({ storeId, startDate, endDate }) => {
    const client = await pool.connect();
    try {
      await checkStoreExistsById(client, storeId);
  
      // Determine grouping interval in hours based on the date range.
      const msInDay = 1000 * 3600 * 24;
      const dayDifference = (new Date(endDate) - new Date(startDate)) / msInDay;
      let groupingInterval;
      if (dayDifference <= 1) {
        groupingInterval = 2;
      } else if (dayDifference <= 2) {
        groupingInterval = 4;
      } else if (dayDifference <= 3) {
        groupingInterval = 6;
      } else {
        groupingInterval = 24;
      }
  
      // Fetch raw purchase data.
      const purchaseQuery = `
        SELECT 
          p.timestamp,
          p.total,
          pl.platform
        FROM purchases p
        JOIN platforms pl ON p.platform_id = pl.id
        WHERE p.store_id = $1
          AND p.timestamp BETWEEN $2 AND $3
      `;
      const purchaseResult = await executeQueryWithoutPool({
        client,
        query: purchaseQuery,
        params: [storeId, startDate, endDate],
      });
  
      // Fetch raw analytics data.
      const analyticsQuery = `
        SELECT
          a.timestamp,
          a.platform_id,
          aa.name AS action_name,
          COUNT(a.action_id) AS action_count
        FROM analytics a
        JOIN analytics_actions aa ON a.action_id = aa.id
        WHERE a.store_id = $1
          AND a.timestamp BETWEEN $2 AND $3
        GROUP BY a.timestamp, a.platform_id, aa.name
      `;
      const analyticsResult = await executeQueryWithoutPool({
        client,
        query: analyticsQuery,
        params: [storeId, startDate, endDate],
      });
  
      // Helper: Floor a timestamp to the nearest lower bucket boundary (UTC)
      const floorToInterval = (dateStr, intervalHours) => {
        const d = new Date(dateStr);
        const hours = d.getUTCHours();
        const bucketHour = Math.floor(hours / intervalHours) * intervalHours;
        d.setUTCHours(bucketHour, 0, 0, 0);
        return d.toISOString();
      };
  
      // Aggregate data into buckets.
      // Each bucket is structured as:
      // {
      //   timestamp: <bucket>,
      //   purchases: { <platform>: <value>, ..., total_count: <value> },
      //   actions: { 
      //      <actionName>: { ios: <value>, android: <value>, total_count: <value> },
      //      ... 
      //   }
      // }
      const buckets = {};
  
      // Process purchase data.
      purchaseResult.rows.forEach(row => {
        const bucket = floorToInterval(row.timestamp, groupingInterval);
        const platform = row.platform.toLowerCase();
        const value = parseFloat(row.total) || 0;
  
        if (value > 0) {
          if (!buckets[bucket]) {
            buckets[bucket] = {
              timestamp: bucket,
              purchases: {},
              actions: {}
            };
          }
          // Initialize the platform if it doesn't exist.
          if (!buckets[bucket].purchases[platform]) {
            buckets[bucket].purchases[platform] = 0;
          }
          buckets[bucket].purchases[platform] += value;
          // Update total count.
          if (!buckets[bucket].purchases.total_count) {
            buckets[bucket].purchases.total_count = 0;
          }
          buckets[bucket].purchases.total_count += value;
        }
      });
  
      // Process analytics data.
      analyticsResult.rows.forEach(row => {
        const bucket = floorToInterval(row.timestamp, groupingInterval);
        const platform = row.platform_id === 1 ? 'ios' : 'android';
        const actionName = row.action_name;
        const count = parseInt(row.action_count, 10) || 0;
  
        if (count > 0) {
          if (!buckets[bucket]) {
            buckets[bucket] = {
              timestamp: bucket,
              purchases: {},
              actions: {}
            };
          }
          if (!buckets[bucket].actions[actionName]) {
            buckets[bucket].actions[actionName] = { ios: 0, android: 0, total_count: 0 };
          }
          buckets[bucket].actions[actionName][platform] += count;
          buckets[bucket].actions[actionName].total_count += count;
        }
      });
  
      // Generate a complete list of bucket keys (timestamps) from startDate to endDate.
      const bucketKeys = [];
      let currentBucketDate = new Date(floorToInterval(startDate, groupingInterval));
      const endDateObj = new Date(endDate);
      while (currentBucketDate <= endDateObj) {
        bucketKeys.push(currentBucketDate.toISOString());
        // Increment by groupingInterval hours.
        currentBucketDate = new Date(currentBucketDate.getTime() + groupingInterval * 3600 * 1000);
      }
  
      // Build final results array including empty buckets.
      let results = bucketKeys.map(bucketKey => {
        if (!buckets[bucketKey]) {
          return {
            timestamp: bucketKey,
            purchases: {},
            actions: {}
          };
        } else {
          return buckets[bucketKey];
        }
      });
  
      // (Optional) Ensure that every bucket's actions object always contains certain expected keys.
      // Define an array of expected actions (adjust as needed).
      const expectedActions = ['view', 'atc'];
      results = results.map(bucket => {
        expectedActions.forEach(actionName => {
          if (!bucket.actions[actionName]) {
            bucket.actions[actionName] = {}; // Add empty object for consistency.
          }
        });
        return bucket;
      });
  
      return results;
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  };
  
  
const getProductsTableAnalyticsService = async ({
    storeId,
    startDate,
    endDate,
    sortKey = 'views',  // Default to 'views'
    sortType = 'desc',  // Default to 'desc'
    limit = 10,
    page = 1
}) => {
    const client = await pool.connect();
    const offset = (page - 1) * limit;
    let totalCount = null; // Fetch only for first page

    try {
        await checkStoreExistsById(client, storeId);

        // Query for action counts (views, atc)
        const query = `
            WITH action_data AS (
                SELECT 
                    a.product_id, 
                    a.action_id, 
                    COUNT(*) AS count
                FROM analytics a
                WHERE a.store_id = $1
                AND a.timestamp BETWEEN $2 AND $3
                GROUP BY a.product_id, a.action_id
            ),
            purchase_data AS (
                SELECT 
                    pp.product_id, 
                    SUM(pp.count) AS purchase_count  -- Directly sum the 'count' from purchase_products
                FROM purchase_products pp
                JOIN purchases p ON pp.purchase_id = p.id
                WHERE p.store_id = $1
                AND p.timestamp BETWEEN $2 AND $3
                GROUP BY pp.product_id
            )
            SELECT 
                COALESCE(ad.product_id, pd.product_id) AS product_id, 
                COALESCE(SUM(CASE WHEN ad.action_id = 1 THEN ad.count ELSE 0 END), 0) AS views,
                COALESCE(SUM(CASE WHEN ad.action_id = 2 THEN ad.count ELSE 0 END), 0) AS atc,
                COALESCE(pd.purchase_count, 0) AS purchase
            FROM action_data ad
            FULL OUTER JOIN purchase_data pd ON ad.product_id = pd.product_id
            GROUP BY COALESCE(ad.product_id, pd.product_id), pd.purchase_count
            ORDER BY ${sortKey} ${sortType}
            LIMIT $4 OFFSET $5
        `;

        const result = await executeQueryWithoutPool({
            client,
            query,
            params: [storeId, startDate, endDate, limit, offset],
        });

        if (page === 1 && result.rows.length > 0) {
            totalCount = result.rows.length; // Extract total count only for first page
        }

        const hasMore = totalCount !== null ? (page * limit) < totalCount : result.rows.length === limit;

        const productIds = result.rows.map(row => row.product_id);
        if (productIds.length === 0) return { data: [], totalCount: 0, hasMore: false };

        // Fetch product titles from Elasticsearch
        const response = await elastic.mget({
            body: {
                docs: productIds.map(id => ({
                    _index: `${storeId}_products`,
                    _id: id.toString(),
                    _source: ['id', 'title'],
                })),
            },
        });

        const productsData = response.docs
            .filter(doc => doc.found)
            .reduce((acc, doc) => {
                acc[doc._id] = doc._source.title;
                return acc;
            }, {});

        return {
            data: result.rows.map(row => ({
                id: row.product_id,
                title: productsData[row.product_id] || 'Unknown',
                views: parseInt(row.views),
                atc: parseInt(row.atc),
                purchase: parseInt(row.purchase)
            })),
            totalCount: parseInt(totalCount),
            hasMore
        };
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

const getOrdersTableAnalyticsService = async ({
    storeId,
    startDate,
    endDate,
    sortKey = 'total',
    sortType = 'desc',
    limit = 10,
    page = 1
}) => {
    const client = await pool.connect();
    const offset = (page - 1) * limit;
    let totalCount = null; // Only fetch on first page

    try {
        await checkStoreExistsById(client, storeId);

        // CTE to calculate product count
        const query = `
            WITH purchases_data AS (
                SELECT 
                    p.id AS purchase_id, 
                    p.timestamp, 
                    p.total,
                    COALESCE(SUM(pp.count), 0) AS products_count
                    ${page === 1 ? ', COUNT(*) OVER() AS total_count' : ''}
                FROM purchases p
                LEFT JOIN purchase_products pp ON p.id = pp.purchase_id
                WHERE p.store_id = $1 
                AND p.timestamp BETWEEN $2 AND $3
                GROUP BY p.id, p.timestamp, p.total
            )
            SELECT *, 
            ${page === 1 ? 'total_count' : 'NULL AS total_count'}
            FROM purchases_data
            ORDER BY 
                ${sortKey === 'count' ? 'products_count' : sortKey} ${sortType},
                timestamp DESC  -- Always ensure recent timestamps are prioritized
            LIMIT $4 OFFSET $5
        `;

        const result = await executeQueryWithoutPool({
            client,
            query,
            params: [storeId, startDate, endDate, limit, offset],
        });

        if (page === 1 && result.rows.length > 0) {
            totalCount = result.rows[0].total_count; // Extract total count only for first page
        }

        const hasMore = totalCount !== null ? (page * limit) < totalCount : result.rows.length === limit;

        return { 
            data: result.rows.map(row => ({
                id: row.purchase_id,
                timestamp: row.timestamp,
                total: row.total,
                count: parseInt(row.products_count)
            })), 
            totalCount: parseInt(totalCount),
            hasMore
        };
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

const getTermsTableAnalyticsService = async ({
  storeId,
  startDate,
  endDate,
  sortKey = 'total',
  sortType = 'desc',
  limit = 10,
  page = 1
}) => {
  const client = await pool.connect();
  const offset = (page - 1) * limit;
  let totalCount = null;

  try {
      await checkStoreExistsById(client, storeId);

      const query = `
          WITH terms_data AS (
              SELECT 
                  COALESCE(NULLIF(t.term, ''), '(empty)') AS term, -- Convert empty strings to '(empty)'
                  COUNT(*) AS total, -- Total occurrences of the term
                  COUNT(*) FILTER (WHERE t.platform_id = 1) AS ios,
                  COUNT(*) FILTER (WHERE t.platform_id = 2) AS android
                  ${page === 1 ? ', COUNT(*) OVER() AS total_count' : ''}
              FROM terms t
              WHERE t.store_id = $1 
              AND t.timestamp BETWEEN $2 AND $3
              GROUP BY COALESCE(NULLIF(t.term, ''), '(empty)') -- Group only by term
          )
          SELECT *, 
              ${page === 1 ? 'total_count' : 'NULL AS total_count'}
          FROM terms_data
          ORDER BY 
              ${sortKey} ${sortType}
          LIMIT $4 OFFSET $5
      `;

      const result = await executeQueryWithoutPool({
          client,
          query,
          params: [storeId, startDate, endDate, limit, offset],
      });

      if (page === 1 && result.rows.length > 0) {
          totalCount = parseInt(result.rows[0].total_count, 10); // Ensure totalCount is an integer
      }

      const hasMore = totalCount !== null ? (page * limit) < totalCount : result.rows.length === limit;

      return { 
          data: result.rows.map(row => ({
              term: row.term,
              ios: parseInt(row.ios),
              android: parseInt(row.android),
              total: parseInt(row.total),
          })), 
          totalCount,
          hasMore
      };
  } catch (error) {
      throw error;
  } finally {
      client.release();
  }
};

module.exports = {
    getChartAnalyticsService,
    getProductsTableAnalyticsService,
    getOrdersTableAnalyticsService,
    getTermsTableAnalyticsService,
}
