/**
 * Country, timezone, and job-title reference data for the onboarding flow.
 *
 * Timezones are keyed by country so the timezone picker can narrow to the
 * zones that actually apply once a country is chosen. The first entry for a
 * country is treated as its default. Countries not listed here (or "Other")
 * fall back to the full IANA list in ALL_TIMEZONES.
 */

export interface CountryInfo {
  name: string;
  timezones: string[];
}

export const COUNTRIES: CountryInfo[] = [
  { name: 'Nigeria', timezones: ['Africa/Lagos'] },
  { name: 'Ghana', timezones: ['Africa/Accra'] },
  { name: 'Algeria', timezones: ['Africa/Algiers'] },
  { name: 'Angola', timezones: ['Africa/Luanda'] },
  { name: 'Benin', timezones: ['Africa/Porto-Novo'] },
  { name: 'Botswana', timezones: ['Africa/Gaborone'] },
  { name: 'Burkina Faso', timezones: ['Africa/Ouagadougou'] },
  { name: 'Cameroon', timezones: ['Africa/Douala'] },
  { name: 'Chad', timezones: ['Africa/Ndjamena'] },
  { name: "Cote d'Ivoire", timezones: ['Africa/Abidjan'] },
  { name: 'Democratic Republic of the Congo', timezones: ['Africa/Kinshasa', 'Africa/Lubumbashi'] },
  { name: 'Egypt', timezones: ['Africa/Cairo'] },
  { name: 'Equatorial Guinea', timezones: ['Africa/Malabo'] },
  { name: 'Ethiopia', timezones: ['Africa/Addis_Ababa'] },
  { name: 'Gabon', timezones: ['Africa/Libreville'] },
  { name: 'Kenya', timezones: ['Africa/Nairobi'] },
  { name: 'Libya', timezones: ['Africa/Tripoli'] },
  { name: 'Morocco', timezones: ['Africa/Casablanca'] },
  { name: 'Mozambique', timezones: ['Africa/Maputo'] },
  { name: 'Namibia', timezones: ['Africa/Windhoek'] },
  { name: 'Niger', timezones: ['Africa/Niamey'] },
  { name: 'Republic of the Congo', timezones: ['Africa/Brazzaville'] },
  { name: 'Rwanda', timezones: ['Africa/Kigali'] },
  { name: 'Senegal', timezones: ['Africa/Dakar'] },
  { name: 'South Africa', timezones: ['Africa/Johannesburg'] },
  { name: 'South Sudan', timezones: ['Africa/Juba'] },
  { name: 'Sudan', timezones: ['Africa/Khartoum'] },
  { name: 'Tanzania', timezones: ['Africa/Dar_es_Salaam'] },
  { name: 'Togo', timezones: ['Africa/Lome'] },
  { name: 'Tunisia', timezones: ['Africa/Tunis'] },
  { name: 'Uganda', timezones: ['Africa/Kampala'] },
  { name: 'Zambia', timezones: ['Africa/Lusaka'] },
  { name: 'Zimbabwe', timezones: ['Africa/Harare'] },
  { name: 'Bahrain', timezones: ['Asia/Bahrain'] },
  { name: 'Iran', timezones: ['Asia/Tehran'] },
  { name: 'Iraq', timezones: ['Asia/Baghdad'] },
  { name: 'Israel', timezones: ['Asia/Jerusalem'] },
  { name: 'Jordan', timezones: ['Asia/Amman'] },
  { name: 'Kuwait', timezones: ['Asia/Kuwait'] },
  { name: 'Lebanon', timezones: ['Asia/Beirut'] },
  { name: 'Oman', timezones: ['Asia/Muscat'] },
  { name: 'Qatar', timezones: ['Asia/Qatar'] },
  { name: 'Saudi Arabia', timezones: ['Asia/Riyadh'] },
  { name: 'United Arab Emirates', timezones: ['Asia/Dubai'] },
  { name: 'Yemen', timezones: ['Asia/Aden'] },
  { name: 'Australia', timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin'] },
  { name: 'Bangladesh', timezones: ['Asia/Dhaka'] },
  { name: 'China', timezones: ['Asia/Shanghai'] },
  { name: 'Hong Kong', timezones: ['Asia/Hong_Kong'] },
  { name: 'India', timezones: ['Asia/Kolkata'] },
  { name: 'Indonesia', timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] },
  { name: 'Japan', timezones: ['Asia/Tokyo'] },
  { name: 'Kazakhstan', timezones: ['Asia/Almaty', 'Asia/Aqtau'] },
  { name: 'Malaysia', timezones: ['Asia/Kuala_Lumpur'] },
  { name: 'Pakistan', timezones: ['Asia/Karachi'] },
  { name: 'Philippines', timezones: ['Asia/Manila'] },
  { name: 'Singapore', timezones: ['Asia/Singapore'] },
  { name: 'South Korea', timezones: ['Asia/Seoul'] },
  { name: 'Thailand', timezones: ['Asia/Bangkok'] },
  { name: 'Turkey', timezones: ['Europe/Istanbul'] },
  { name: 'Vietnam', timezones: ['Asia/Ho_Chi_Minh'] },
  { name: 'Austria', timezones: ['Europe/Vienna'] },
  { name: 'Azerbaijan', timezones: ['Asia/Baku'] },
  { name: 'Belgium', timezones: ['Europe/Brussels'] },
  { name: 'Denmark', timezones: ['Europe/Copenhagen'] },
  { name: 'Finland', timezones: ['Europe/Helsinki'] },
  { name: 'France', timezones: ['Europe/Paris'] },
  { name: 'Germany', timezones: ['Europe/Berlin'] },
  { name: 'Greece', timezones: ['Europe/Athens'] },
  { name: 'Ireland', timezones: ['Europe/Dublin'] },
  { name: 'Italy', timezones: ['Europe/Rome'] },
  { name: 'Netherlands', timezones: ['Europe/Amsterdam'] },
  { name: 'Norway', timezones: ['Europe/Oslo'] },
  { name: 'Poland', timezones: ['Europe/Warsaw'] },
  { name: 'Portugal', timezones: ['Europe/Lisbon'] },
  { name: 'Romania', timezones: ['Europe/Bucharest'] },
  { name: 'Russia', timezones: ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok'] },
  { name: 'Spain', timezones: ['Europe/Madrid'] },
  { name: 'Sweden', timezones: ['Europe/Stockholm'] },
  { name: 'Switzerland', timezones: ['Europe/Zurich'] },
  { name: 'Ukraine', timezones: ['Europe/Kyiv'] },
  { name: 'United Kingdom', timezones: ['Europe/London'] },
  { name: 'Canada', timezones: ['America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Halifax', 'America/St_Johns'] },
  { name: 'Mexico', timezones: ['America/Mexico_City', 'America/Monterrey', 'America/Tijuana'] },
  { name: 'United States', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'] },
  { name: 'Argentina', timezones: ['America/Argentina/Buenos_Aires'] },
  { name: 'Brazil', timezones: ['America/Sao_Paulo', 'America/Manaus', 'America/Bahia', 'America/Fortaleza'] },
  { name: 'Chile', timezones: ['America/Santiago'] },
  { name: 'Colombia', timezones: ['America/Bogota'] },
  { name: 'Ecuador', timezones: ['America/Guayaquil'] },
  { name: 'Peru', timezones: ['America/Lima'] },
  { name: 'Trinidad and Tobago', timezones: ['America/Port_of_Spain'] },
  { name: 'Venezuela', timezones: ['America/Caracas'] },
];

/** Curated IANA fallback list used when a country has no mapping or "Other". */
export const ALL_TIMEZONES: string[] = Array.from(
  new Set([
    ...COUNTRIES.flatMap((country) => country.timezones),
    'UTC',
    'Atlantic/Reykjavik',
    'America/Bogota',
    'America/Argentina/Buenos_Aires',
    'Pacific/Auckland',
  ]),
).sort();

export const COUNTRY_NAMES: string[] = COUNTRIES.map((country) => country.name);

export function timezonesForCountry(country: string): string[] {
  const match = COUNTRIES.find((entry) => entry.name === country);
  return match ? match.timezones : ALL_TIMEZONES;
}

export function defaultTimezoneForCountry(country: string): string {
  return timezonesForCountry(country)[0] ?? 'UTC';
}

export const JOB_TITLES: string[] = [
  'Petroleum Engineer',
  'Reservoir Engineer',
  'Drilling Engineer',
  'Production Engineer',
  'Completions Engineer',
  'Process Engineer',
  'Facilities Engineer',
  'Pipeline Engineer',
  'Geologist',
  'Geophysicist',
  'HSE Manager',
  'HSE Officer',
  'Safety Engineer',
  'Environmental / Emissions Lead',
  'Regulatory / Compliance Officer',
  'Operations Manager',
  'Field Supervisor',
  'Plant / Refinery Manager',
  'Maintenance Engineer',
  'Project Manager',
  'Commercial / Business Development Manager',
  'Trading / Marketing Analyst',
  'Procurement / Contracts Manager',
  'Finance / Investment Analyst',
  'Data Scientist / Analyst',
  'Software Engineer',
  'Consultant / Advisor',
  'Executive / Director',
  'Researcher / Academic',
  'Student',
];
