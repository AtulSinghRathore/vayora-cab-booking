export const fallbackIndianCities = [
  ["Jamshedpur", "Jharkhand", 22.8046, 86.2029], ["Ranchi", "Jharkhand", 23.3441, 85.3096],
  ["Dhanbad", "Jharkhand", 23.7957, 86.4304], ["Bokaro", "Jharkhand", 23.6693, 86.1511],
  ["Deoghar", "Jharkhand", 24.4852, 86.6948], ["Hazaribagh", "Jharkhand", 23.9925, 85.3637],
  ["Kolkata", "West Bengal", 22.5726, 88.3639], ["Howrah", "West Bengal", 22.5958, 88.2636],
  ["Durgapur", "West Bengal", 23.5204, 87.3119], ["Asansol", "West Bengal", 23.6739, 86.9524],
  ["Siliguri", "West Bengal", 26.7271, 88.3953], ["Bhubaneswar", "Odisha", 20.2961, 85.8245],
  ["Cuttack", "Odisha", 20.4625, 85.8830], ["Puri", "Odisha", 19.8135, 85.8312],
  ["Rourkela", "Odisha", 22.2604, 84.8536], ["Patna", "Bihar", 25.5941, 85.1376],
  ["Gaya", "Bihar", 24.7914, 85.0002], ["Muzaffarpur", "Bihar", 26.1197, 85.3910],
  ["Bhagalpur", "Bihar", 25.2425, 86.9842], ["Varanasi", "Uttar Pradesh", 25.3176, 82.9739],
  ["Lucknow", "Uttar Pradesh", 26.8467, 80.9462], ["Prayagraj", "Uttar Pradesh", 25.4358, 81.8463],
  ["Kanpur", "Uttar Pradesh", 26.4499, 80.3319], ["Agra", "Uttar Pradesh", 27.1767, 78.0081],
  ["Delhi", "Delhi", 28.6139, 77.2090], ["Gurugram", "Haryana", 28.4595, 77.0266],
  ["Noida", "Uttar Pradesh", 28.5355, 77.3910], ["Jaipur", "Rajasthan", 26.9124, 75.7873],
  ["Mumbai", "Maharashtra", 19.0760, 72.8777], ["Pune", "Maharashtra", 18.5204, 73.8567],
  ["Nagpur", "Maharashtra", 21.1458, 79.0882], ["Ahmedabad", "Gujarat", 23.0225, 72.5714],
  ["Surat", "Gujarat", 21.1702, 72.8311], ["Indore", "Madhya Pradesh", 22.7196, 75.8577],
  ["Bhopal", "Madhya Pradesh", 23.2599, 77.4126], ["Raipur", "Chhattisgarh", 21.2514, 81.6296],
  ["Bilaspur", "Chhattisgarh", 22.0797, 82.1409], ["Hyderabad", "Telangana", 17.3850, 78.4867],
  ["Bengaluru", "Karnataka", 12.9716, 77.5946], ["Chennai", "Tamil Nadu", 13.0827, 80.2707],
  ["Kochi", "Kerala", 9.9312, 76.2673], ["Thiruvananthapuram", "Kerala", 8.5241, 76.9366],
  ["Goa", "Goa", 15.2993, 74.1240], ["Chandigarh", "Chandigarh", 30.7333, 76.7794],
  ["Amritsar", "Punjab", 31.6340, 74.8723], ["Shimla", "Himachal Pradesh", 31.1048, 77.1734],
  ["Dehradun", "Uttarakhand", 30.3165, 78.0322], ["Guwahati", "Assam", 26.1445, 91.7362],
] as const;

export function searchFallbackCities(query: string) {
  const normalizedQuery = query.toLowerCase();
  return fallbackIndianCities
    .filter(([city, state]) => city.toLowerCase().includes(normalizedQuery) || state.toLowerCase().includes(normalizedQuery))
    .slice(0, 8)
    .map(([city, state, lat, lon], index) => ({
      id: `fallback-${city}-${index}`,
      city,
      state,
      displayName: `${city}, ${state}, India`,
      lat,
      lon,
    }));
}
