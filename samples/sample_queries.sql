-- Sample BigQuery SQL queries to test the BigQuery Previewer extension
-- Each query demonstrates different features and potential scan sizes

-- Simple query (small scan size)
SELECT 
  event_date, 
  COUNT(*) as event_count
FROM 
  `bigquery-public-data.google_analytics_sample.ga_sessions_*`
WHERE 
  _TABLE_SUFFIX BETWEEN '20170101' AND '20170107'
GROUP BY 
  event_date
ORDER BY 
  event_date;

-- Medium scan size query
SELECT 
  device.browser,
  device.operatingSystem,
  geoNetwork.country,
  COUNT(*) AS sessions,
  SUM(totals.visits) AS visits,
  SUM(totals.pageviews) AS pageviews,
  SUM(totals.transactions) AS transactions,
  ROUND(SUM(totals.transactionRevenue)/1000000, 2) AS revenue
FROM 
  `bigquery-public-data.google_analytics_sample.ga_sessions_*`
WHERE 
  _TABLE_SUFFIX BETWEEN '20170101' AND '20170331'
GROUP BY 
  1, 2, 3
ORDER BY 
  sessions DESC
LIMIT 
  100;

-- Large scan size query (should trigger warning)
SELECT 
  EXTRACT(MONTH FROM PARSE_DATE('%Y%m%d', date)) AS month,
  EXTRACT(YEAR FROM PARSE_DATE('%Y%m%d', date)) AS year,
  geoNetwork.country,
  device.deviceCategory,
  device.browser,
  device.operatingSystem,
  trafficSource.source,
  trafficSource.medium,
  channelGrouping,
  COUNT(fullVisitorId) AS visitors,
  SUM(totals.visits) AS visits,
  SUM(totals.pageviews) AS pageviews,
  SUM(totals.transactions) AS transactions,
  ROUND(SUM(totals.transactionRevenue)/1000000, 2) AS revenue
FROM 
  `bigquery-public-data.google_analytics_sample.ga_sessions_*`
WHERE
  _TABLE_SUFFIX BETWEEN '20160101' AND '20170630'
GROUP BY 
  1, 2, 3, 4, 5, 6, 7, 8, 9
ORDER BY 
  year, month, visitors DESC;

-- Query with syntax error (to test error detection)
SELECT 
  event_date 
  COUNT(*) as event_count  -- Missing comma here
FROM 
  `bigquery-public-data.google_analytics_sample.ga_sessions_*`
WHERE 
  _TABLE_SUFFIX BETWEEN '20170101' AND '20170107'
GROUP BY 
  event_date;