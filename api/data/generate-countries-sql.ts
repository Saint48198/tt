import { writeFileSync } from 'fs';
import { join } from 'path';

// Comprehensive world countries data with 3-char ISO code, region, and approximate center coordinates
const worldCountries = [
  { name: 'Afghanistan', abbr: 'AFG', region: 'Asia', lat: 33.9391, lng: 67.2994 },
  { name: 'Albania', abbr: 'ALB', region: 'Europe', lat: 41.1533, lng: 20.1683 },
  { name: 'Algeria', abbr: 'DZA', region: 'Africa', lat: 28.0339, lng: 1.6596 },
  { name: 'Andorra', abbr: 'AND', region: 'Europe', lat: 42.5063, lng: 1.5218 },
  { name: 'Angola', abbr: 'AGO', region: 'Africa', lat: -11.2027, lng: 17.8739 },
  {
    name: 'Antigua and Barbuda',
    abbr: 'ATG',
    region: 'North America',
    lat: 17.0578,
    lng: -61.7964,
  },
  { name: 'Argentina', abbr: 'ARG', region: 'South America', lat: -38.4161, lng: -63.6167 },
  { name: 'Armenia', abbr: 'ARM', region: 'Asia', lat: 40.0691, lng: 45.0382 },
  { name: 'Australia', abbr: 'AUS', region: 'Oceania', lat: -25.2744, lng: 133.7751 },
  { name: 'Austria', abbr: 'AUT', region: 'Europe', lat: 47.5162, lng: 14.5501 },
  { name: 'Azerbaijan', abbr: 'AZE', region: 'Asia', lat: 40.1431, lng: 47.5769 },
  { name: 'Bahamas', abbr: 'BHS', region: 'North America', lat: 25.0343, lng: -77.3963 },
  { name: 'Bahrain', abbr: 'BHR', region: 'Asia', lat: 26.0667, lng: 50.5577 },
  { name: 'Bangladesh', abbr: 'BGD', region: 'Asia', lat: 23.685, lng: 90.3563 },
  { name: 'Barbados', abbr: 'BRB', region: 'North America', lat: 13.1939, lng: -59.5432 },
  { name: 'Belarus', abbr: 'BLR', region: 'Europe', lat: 53.7098, lng: 27.9534 },
  { name: 'Belgium', abbr: 'BEL', region: 'Europe', lat: 50.5039, lng: 4.4699 },
  { name: 'Belize', abbr: 'BLZ', region: 'North America', lat: 17.1899, lng: -88.7979 },
  { name: 'Benin', abbr: 'BEN', region: 'Africa', lat: 9.3077, lng: 2.3158 },
  { name: 'Bhutan', abbr: 'BTN', region: 'Asia', lat: 27.5142, lng: 90.4336 },
  { name: 'Bolivia', abbr: 'BOL', region: 'South America', lat: -16.2902, lng: -63.5887 },
  { name: 'Bosnia and Herzegovina', abbr: 'BIH', region: 'Europe', lat: 43.9159, lng: 17.6791 },
  { name: 'Botswana', abbr: 'BWA', region: 'Africa', lat: -22.3285, lng: 24.6849 },
  { name: 'Brazil', abbr: 'BRA', region: 'South America', lat: -14.235, lng: -51.9253 },
  { name: 'Brunei', abbr: 'BRN', region: 'Asia', lat: 4.5353, lng: 114.7277 },
  { name: 'Bulgaria', abbr: 'BGR', region: 'Europe', lat: 42.7339, lng: 25.4858 },
  { name: 'Burkina Faso', abbr: 'BFA', region: 'Africa', lat: 12.2383, lng: -1.5616 },
  { name: 'Burundi', abbr: 'BDI', region: 'Africa', lat: -3.3731, lng: 29.9189 },
  { name: 'Cambodia', abbr: 'KHM', region: 'Asia', lat: 12.5657, lng: 104.991 },
  { name: 'Cameroon', abbr: 'CMR', region: 'Africa', lat: 3.848, lng: 11.5021 },
  { name: 'Canada', abbr: 'CAN', region: 'North America', lat: 56.1304, lng: -106.3468 },
  { name: 'Cape Verde', abbr: 'CPV', region: 'Africa', lat: 16.5388, lng: -23.0418 },
  { name: 'Central African Republic', abbr: 'CAF', region: 'Africa', lat: 6.6111, lng: 20.9394 },
  { name: 'Chad', abbr: 'TCD', region: 'Africa', lat: 15.4542, lng: 18.7322 },
  { name: 'Chile', abbr: 'CHL', region: 'South America', lat: -35.6751, lng: -71.543 },
  { name: 'China', abbr: 'CHN', region: 'Asia', lat: 35.8617, lng: 104.1954 },
  { name: 'Colombia', abbr: 'COL', region: 'South America', lat: 4.5709, lng: -74.2973 },
  { name: 'Comoros', abbr: 'COM', region: 'Africa', lat: -11.6455, lng: 43.3333 },
  { name: 'Congo', abbr: 'COG', region: 'Africa', lat: -4.0383, lng: 21.7587 },
  {
    name: 'Congo (Democratic Republic)',
    abbr: 'COD',
    region: 'Africa',
    lat: -4.0383,
    lng: 21.7587,
  },
  { name: 'Costa Rica', abbr: 'CRI', region: 'North America', lat: 9.7489, lng: -83.7534 },
  { name: 'Croatia', abbr: 'HRV', region: 'Europe', lat: 45.1, lng: 15.2 },
  { name: 'Cuba', abbr: 'CUB', region: 'North America', lat: 21.5218, lng: -77.7812 },
  { name: 'Cyprus', abbr: 'CYP', region: 'Europe', lat: 34.9249, lng: 33.4299 },
  { name: 'Czech Republic', abbr: 'CZE', region: 'Europe', lat: 49.8175, lng: 15.473 },
  { name: "Côte d'Ivoire", abbr: 'CIV', region: 'Africa', lat: 7.54, lng: -5.5471 },
  { name: 'Denmark', abbr: 'DNK', region: 'Europe', lat: 56.2639, lng: 9.5018 },
  { name: 'Djibouti', abbr: 'DJI', region: 'Africa', lat: 11.8254, lng: 42.5903 },
  { name: 'Dominica', abbr: 'DMA', region: 'North America', lat: 15.415, lng: -61.371 },
  { name: 'Dominican Republic', abbr: 'DOM', region: 'North America', lat: 18.9712, lng: -70.2674 },
  { name: 'Ecuador', abbr: 'ECU', region: 'South America', lat: -1.8312, lng: -78.1834 },
  { name: 'Egypt', abbr: 'EGY', region: 'Africa', lat: 26.8206, lng: 30.8025 },
  { name: 'El Salvador', abbr: 'SLV', region: 'North America', lat: 13.7942, lng: -88.8965 },
  { name: 'Equatorial Guinea', abbr: 'GNQ', region: 'Africa', lat: 1.6508, lng: 10.2679 },
  { name: 'Eritrea', abbr: 'ERI', region: 'Africa', lat: 15.1794, lng: 39.7823 },
  { name: 'Estonia', abbr: 'EST', region: 'Europe', lat: 58.5953, lng: 25.0136 },
  { name: 'Eswatini', abbr: 'SWZ', region: 'Africa', lat: -26.5225, lng: 31.4659 },
  { name: 'Ethiopia', abbr: 'ETH', region: 'Africa', lat: 9.145, lng: 40.4897 },
  { name: 'Fiji', abbr: 'FJI', region: 'Oceania', lat: -17.7134, lng: 178.065 },
  { name: 'Finland', abbr: 'FIN', region: 'Europe', lat: 61.9241, lng: 25.7482 },
  { name: 'France', abbr: 'FRA', region: 'Europe', lat: 46.2276, lng: 2.2137 },
  { name: 'Gabon', abbr: 'GAB', region: 'Africa', lat: -0.8037, lng: 11.6045 },
  { name: 'Gambia', abbr: 'GMB', region: 'Africa', lat: 13.4549, lng: -15.3105 },
  { name: 'Georgia', abbr: 'GEO', region: 'Asia', lat: 42.3154, lng: 43.3569 },
  { name: 'Germany', abbr: 'DEU', region: 'Europe', lat: 51.1657, lng: 10.4515 },
  { name: 'Ghana', abbr: 'GHA', region: 'Africa', lat: 7.3697, lng: -5.3677 },
  { name: 'Greece', abbr: 'GRC', region: 'Europe', lat: 39.0742, lng: 21.8243 },
  { name: 'Grenada', abbr: 'GRD', region: 'North America', lat: 12.1165, lng: -61.679 },
  { name: 'Guatemala', abbr: 'GTM', region: 'North America', lat: 15.7835, lng: -90.2308 },
  { name: 'Guinea', abbr: 'GIN', region: 'Africa', lat: 9.9456, lng: -9.6966 },
  { name: 'Guinea-Bissau', abbr: 'GNB', region: 'Africa', lat: 11.8037, lng: -15.1804 },
  { name: 'Guyana', abbr: 'GUY', region: 'South America', lat: 4.8604, lng: -58.9302 },
  { name: 'Haiti', abbr: 'HTI', region: 'North America', lat: 18.9712, lng: -72.2852 },
  { name: 'Honduras', abbr: 'HND', region: 'North America', lat: 15.2, lng: -86.2419 },
  { name: 'Hungary', abbr: 'HUN', region: 'Europe', lat: 47.1625, lng: 19.5033 },
  { name: 'Iceland', abbr: 'ISL', region: 'Europe', lat: 64.9631, lng: -19.0208 },
  { name: 'India', abbr: 'IND', region: 'Asia', lat: 20.5937, lng: 78.9629 },
  { name: 'Indonesia', abbr: 'IDN', region: 'Asia', lat: -0.7893, lng: 113.9213 },
  { name: 'Iran', abbr: 'IRN', region: 'Asia', lat: 32.4279, lng: 53.688 },
  { name: 'Iraq', abbr: 'IRQ', region: 'Asia', lat: 33.2232, lng: 43.6793 },
  { name: 'Ireland', abbr: 'IRL', region: 'Europe', lat: 53.4129, lng: -8.2439 },
  { name: 'Israel', abbr: 'ISR', region: 'Asia', lat: 31.0461, lng: 34.8516 },
  { name: 'Italy', abbr: 'ITA', region: 'Europe', lat: 41.8719, lng: 12.5674 },
  { name: 'Jamaica', abbr: 'JAM', region: 'North America', lat: 18.1096, lng: -77.2975 },
  { name: 'Japan', abbr: 'JPN', region: 'Asia', lat: 36.2048, lng: 138.2529 },
  { name: 'Jordan', abbr: 'JOR', region: 'Asia', lat: 30.5852, lng: 36.2384 },
  { name: 'Kazakhstan', abbr: 'KAZ', region: 'Asia', lat: 48.0196, lng: 66.9237 },
  { name: 'Kenya', abbr: 'KEN', region: 'Africa', lat: -0.0236, lng: 37.9062 },
  { name: 'Kiribati', abbr: 'KIR', region: 'Oceania', lat: -3.3704, lng: -168.734 },
  { name: 'Kosovo', abbr: 'KOS', region: 'Europe', lat: 42.6026, lng: 21.1787 },
  { name: 'Kuwait', abbr: 'KWT', region: 'Asia', lat: 29.3117, lng: 47.4818 },
  { name: 'Kyrgyzstan', abbr: 'KGZ', region: 'Asia', lat: 41.2044, lng: 74.7661 },
  { name: 'Laos', abbr: 'LAO', region: 'Asia', lat: 19.8523, lng: 102.4955 },
  { name: 'Latvia', abbr: 'LVA', region: 'Europe', lat: 56.8796, lng: 24.6032 },
  { name: 'Lebanon', abbr: 'LBN', region: 'Asia', lat: 33.8547, lng: 35.8623 },
  { name: 'Lesotho', abbr: 'LSO', region: 'Africa', lat: -29.61, lng: 28.2336 },
  { name: 'Liberia', abbr: 'LBR', region: 'Africa', lat: 6.4281, lng: -9.4295 },
  { name: 'Libya', abbr: 'LBY', region: 'Africa', lat: 26.3351, lng: 17.2283 },
  { name: 'Liechtenstein', abbr: 'LIE', region: 'Europe', lat: 47.166, lng: 9.5554 },
  { name: 'Lithuania', abbr: 'LTU', region: 'Europe', lat: 55.1694, lng: 23.8813 },
  { name: 'Luxembourg', abbr: 'LUX', region: 'Europe', lat: 49.8153, lng: 6.1296 },
  { name: 'Madagascar', abbr: 'MDG', region: 'Africa', lat: -18.7669, lng: 46.8691 },
  { name: 'Malawi', abbr: 'MWI', region: 'Africa', lat: -13.2543, lng: 34.3015 },
  { name: 'Malaysia', abbr: 'MYS', region: 'Asia', lat: 4.2105, lng: 101.6964 },
  { name: 'Maldives', abbr: 'MDV', region: 'Asia', lat: 3.2028, lng: 73.2207 },
  { name: 'Mali', abbr: 'MLI', region: 'Africa', lat: 17.5707, lng: -3.9962 },
  { name: 'Malta', abbr: 'MLT', region: 'Europe', lat: 35.9375, lng: 14.3754 },
  { name: 'Marshall Islands', abbr: 'MHL', region: 'Oceania', lat: 7.1315, lng: 171.1845 },
  { name: 'Mauritania', abbr: 'MRT', region: 'Africa', lat: 21.0079, lng: -10.9408 },
  { name: 'Mauritius', abbr: 'MUS', region: 'Africa', lat: -20.3484, lng: 57.5522 },
  { name: 'Mexico', abbr: 'MEX', region: 'North America', lat: 23.6345, lng: -102.5528 },
  { name: 'Micronesia', abbr: 'FSM', region: 'Oceania', lat: 7.4256, lng: 150.5508 },
  { name: 'Moldova', abbr: 'MDA', region: 'Europe', lat: 47.4116, lng: 28.3699 },
  { name: 'Monaco', abbr: 'MCO', region: 'Europe', lat: 43.7384, lng: 7.4246 },
  { name: 'Mongolia', abbr: 'MNG', region: 'Asia', lat: 46.8625, lng: 103.8467 },
  { name: 'Montenegro', abbr: 'MNE', region: 'Europe', lat: 42.7087, lng: 19.3744 },
  { name: 'Morocco', abbr: 'MAR', region: 'Africa', lat: 31.7917, lng: -7.0926 },
  { name: 'Mozambique', abbr: 'MOZ', region: 'Africa', lat: -18.6657, lng: 35.5296 },
  { name: 'Myanmar', abbr: 'MMR', region: 'Asia', lat: 21.9162, lng: 95.956 },
  { name: 'Namibia', abbr: 'NAM', region: 'Africa', lat: -22.9375, lng: 18.6947 },
  { name: 'Nauru', abbr: 'NRU', region: 'Oceania', lat: -0.5228, lng: 166.9315 },
  { name: 'Nepal', abbr: 'NPL', region: 'Asia', lat: 28.3949, lng: 84.124 },
  { name: 'Netherlands', abbr: 'NLD', region: 'Europe', lat: 52.1326, lng: 5.2913 },
  { name: 'New Zealand', abbr: 'NZL', region: 'Oceania', lat: -40.9006, lng: 174.886 },
  { name: 'Nicaragua', abbr: 'NIC', region: 'North America', lat: 12.8654, lng: -85.2072 },
  { name: 'Niger', abbr: 'NER', region: 'Africa', lat: 17.6078, lng: 8.6753 },
  { name: 'Nigeria', abbr: 'NGA', region: 'Africa', lat: 9.082, lng: 8.6753 },
  { name: 'North Korea', abbr: 'PRK', region: 'Asia', lat: 40.3399, lng: 127.5101 },
  { name: 'North Macedonia', abbr: 'MKD', region: 'Europe', lat: 41.6086, lng: 21.7453 },
  { name: 'Norway', abbr: 'NOR', region: 'Europe', lat: 60.472, lng: 8.4689 },
  { name: 'Oman', abbr: 'OMN', region: 'Asia', lat: 21.4735, lng: 55.9754 },
  { name: 'Pakistan', abbr: 'PAK', region: 'Asia', lat: 30.3753, lng: 69.3451 },
  { name: 'Palau', abbr: 'PLW', region: 'Oceania', lat: 7.315, lng: 134.4807 },
  { name: 'Palestine', abbr: 'PSE', region: 'Asia', lat: 31.9454, lng: 35.2338 },
  { name: 'Panama', abbr: 'PAN', region: 'North America', lat: 8.538, lng: -80.7821 },
  { name: 'Papua New Guinea', abbr: 'PNG', region: 'Oceania', lat: -6.315, lng: 143.9555 },
  { name: 'Paraguay', abbr: 'PRY', region: 'South America', lat: -23.4425, lng: -58.4438 },
  { name: 'Peru', abbr: 'PER', region: 'South America', lat: -9.19, lng: -75.0152 },
  { name: 'Philippines', abbr: 'PHL', region: 'Asia', lat: 12.8797, lng: 121.774 },
  { name: 'Poland', abbr: 'POL', region: 'Europe', lat: 51.9194, lng: 19.1451 },
  { name: 'Portugal', abbr: 'PRT', region: 'Europe', lat: 39.3999, lng: -8.2245 },
  { name: 'Qatar', abbr: 'QAT', region: 'Asia', lat: 25.3548, lng: 51.1839 },
  { name: 'Romania', abbr: 'ROU', region: 'Europe', lat: 45.9432, lng: 24.9668 },
  { name: 'Russia', abbr: 'RUS', region: 'Europe', lat: 61.524, lng: 105.3188 },
  { name: 'Rwanda', abbr: 'RWA', region: 'Africa', lat: -1.9536, lng: 29.8739 },
  {
    name: 'Saint Kitts and Nevis',
    abbr: 'KNA',
    region: 'North America',
    lat: 17.2978,
    lng: -62.783,
  },
  { name: 'Saint Lucia', abbr: 'LCA', region: 'North America', lat: 13.9094, lng: -60.9789 },
  {
    name: 'Saint Vincent and the Grenadines',
    abbr: 'VCT',
    region: 'North America',
    lat: 12.9843,
    lng: -61.2872,
  },
  { name: 'Samoa', abbr: 'WSM', region: 'Oceania', lat: -13.759, lng: -172.1046 },
  { name: 'San Marino', abbr: 'SMR', region: 'Europe', lat: 43.9424, lng: 12.4578 },
  { name: 'Sao Tome and Principe', abbr: 'STP', region: 'Africa', lat: 0.1864, lng: 6.6131 },
  { name: 'Saudi Arabia', abbr: 'SAU', region: 'Asia', lat: 23.8859, lng: 45.0792 },
  { name: 'Senegal', abbr: 'SEN', region: 'Africa', lat: 14.4974, lng: -14.4524 },
  { name: 'Serbia', abbr: 'SRB', region: 'Europe', lat: 44.0165, lng: 21.0059 },
  { name: 'Seychelles', abbr: 'SYC', region: 'Africa', lat: -4.6796, lng: 55.492 },
  { name: 'Sierra Leone', abbr: 'SLE', region: 'Africa', lat: 8.4606, lng: -11.7799 },
  { name: 'Singapore', abbr: 'SGP', region: 'Asia', lat: 1.3521, lng: 103.8198 },
  { name: 'Slovakia', abbr: 'SVK', region: 'Europe', lat: 48.669, lng: 19.699 },
  { name: 'Slovenia', abbr: 'SVN', region: 'Europe', lat: 46.1512, lng: 14.9955 },
  { name: 'Solomon Islands', abbr: 'SLB', region: 'Oceania', lat: -9.6412, lng: 160.1562 },
  { name: 'Somalia', abbr: 'SOM', region: 'Africa', lat: 5.1521, lng: 46.1996 },
  { name: 'South Africa', abbr: 'ZAF', region: 'Africa', lat: -30.5595, lng: 22.9375 },
  { name: 'South Korea', abbr: 'KOR', region: 'Asia', lat: 35.9078, lng: 127.7669 },
  { name: 'South Sudan', abbr: 'SSD', region: 'Africa', lat: 6.877, lng: 31.307 },
  { name: 'Spain', abbr: 'ESP', region: 'Europe', lat: 40.4637, lng: -3.7492 },
  { name: 'Sri Lanka', abbr: 'LKA', region: 'Asia', lat: 7.8731, lng: 80.7718 },
  { name: 'Sudan', abbr: 'SDN', region: 'Africa', lat: 12.8628, lng: 30.8065 },
  { name: 'Suriname', abbr: 'SUR', region: 'South America', lat: 3.9193, lng: -56.0278 },
  { name: 'Sweden', abbr: 'SWE', region: 'Europe', lat: 60.1282, lng: 18.6435 },
  { name: 'Switzerland', abbr: 'CHE', region: 'Europe', lat: 46.8182, lng: 8.2275 },
  { name: 'Syria', abbr: 'SYR', region: 'Asia', lat: 34.8021, lng: 38.9968 },
  { name: 'Taiwan', abbr: 'TWN', region: 'Asia', lat: 23.6978, lng: 120.9605 },
  { name: 'Tajikistan', abbr: 'TJK', region: 'Asia', lat: 38.861, lng: 71.2761 },
  { name: 'Tanzania', abbr: 'TZA', region: 'Africa', lat: -6.369, lng: 34.8888 },
  { name: 'Thailand', abbr: 'THA', region: 'Asia', lat: 15.87, lng: 100.9925 },
  { name: 'Timor-Leste', abbr: 'TLS', region: 'Asia', lat: -8.8383, lng: 125.9181 },
  { name: 'Togo', abbr: 'TGO', region: 'Africa', lat: 6.1256, lng: 1.2324 },
  { name: 'Tonga', abbr: 'TON', region: 'Oceania', lat: -21.1789, lng: -175.1982 },
  {
    name: 'Trinidad and Tobago',
    abbr: 'TTO',
    region: 'North America',
    lat: 10.6918,
    lng: -61.2225,
  },
  { name: 'Tunisia', abbr: 'TUN', region: 'Africa', lat: 33.8869, lng: 9.5375 },
  { name: 'Turkey', abbr: 'TUR', region: 'Europe', lat: 38.9637, lng: 35.2433 },
  { name: 'Turkmenistan', abbr: 'TKM', region: 'Asia', lat: 38.9697, lng: 59.5563 },
  { name: 'Tuvalu', abbr: 'TUV', region: 'Oceania', lat: -8.5211, lng: 179.1982 },
  { name: 'Uganda', abbr: 'UGA', region: 'Africa', lat: 1.3733, lng: 32.2903 },
  { name: 'Ukraine', abbr: 'UKR', region: 'Europe', lat: 48.3794, lng: 31.1656 },
  { name: 'United Arab Emirates', abbr: 'ARE', region: 'Asia', lat: 23.4241, lng: 53.8478 },
  { name: 'United Kingdom', abbr: 'GBR', region: 'Europe', lat: 55.3781, lng: -3.436 },
  { name: 'United States', abbr: 'USA', region: 'North America', lat: 37.0902, lng: -95.7129 },
  { name: 'Uruguay', abbr: 'URY', region: 'South America', lat: -32.5228, lng: -55.7658 },
  { name: 'Uzbekistan', abbr: 'UZB', region: 'Asia', lat: 41.3775, lng: 64.5853 },
  { name: 'Vanuatu', abbr: 'VUT', region: 'Oceania', lat: -17.7404, lng: 168.3045 },
  { name: 'Vatican City', abbr: 'VAT', region: 'Europe', lat: 41.9029, lng: 12.4534 },
  { name: 'Venezuela', abbr: 'VEN', region: 'South America', lat: 6.4238, lng: -66.5897 },
  { name: 'Vietnam', abbr: 'VNM', region: 'Asia', lat: 14.0583, lng: 108.2772 },
  { name: 'Yemen', abbr: 'YEM', region: 'Asia', lat: 15.5527, lng: 48.5164 },
  { name: 'Zambia', abbr: 'ZMB', region: 'Africa', lat: -13.1339, lng: 27.8493 },
  { name: 'Zimbabwe', abbr: 'ZWE', region: 'Africa', lat: -19.0154, lng: 29.1549 },
];

// Map region names to world_region_id (from the migrations/add-world-regions.sql)
const regionMap: { [key: string]: number } = {
  Africa: 1,
  Asia: 2,
  Europe: 3,
  'North America': 4,
  'South America': 5,
  Oceania: 6,
};

// Generate SQL INSERT or UPDATE statements
function generateSQL(): string {
  let sql = '-- World Countries Data - Generated SQL\n';
  sql += '-- Insert or update all world countries with coordinates and regions\n\n';

  // First, we'll use INSERT ... ON CONFLICT to upsert
  sql += 'INSERT INTO countries (name, abbreviation, lat, lng, world_region_id) VALUES\n';

  const values = worldCountries.map((country, index) => {
    const worldRegionId = regionMap[country.region] || null;
    const comma = index === worldCountries.length - 1 ? ';' : ',';
    return `('${country.name.replace(/'/g, "''")}', '${country.abbr}', ${country.lat}, ${country.lng}, ${worldRegionId})${comma}`;
  });

  sql += values.join('\n');

  sql += '\n\n-- Alternative: Handle duplicates by name\n';
  sql += '-- If you need to update existing records instead of insert:\n\n';

  // Add update statements for existing countries
  for (const country of worldCountries) {
    const worldRegionId = regionMap[country.region] || null;
    sql += `-- UPDATE countries SET abbreviation = '${country.abbr}', lat = ${country.lat}, lng = ${country.lng}, world_region_id = ${worldRegionId} WHERE LOWER(name) = LOWER('${country.name}');\n`;
  }

  return sql;
}

// Write to file
const outputPath = join(__dirname, 'world-countries-data.sql');
const sqlContent = generateSQL();
writeFileSync(outputPath, sqlContent, 'utf-8');

console.log(`✓ Generated SQL file with ${worldCountries.length} countries`);
console.log(`  Output: ${outputPath}`);
console.log('\nRegion mapping:');
Object.entries(regionMap).forEach(([region, id]) => {
  const count = worldCountries.filter((c) => c.region === region).length;
  console.log(`  ${region}: ${count} countries (world_region_id: ${id})`);
});
