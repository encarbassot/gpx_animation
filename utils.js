function euclideanDistance([lat1, lon1], [lat2, lon2]) {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

async function getPolygonFromGpx(url) {
  try {
    const response = await fetch(url);
    const gpxData = await response.text();

    const parser = new DOMParser();
    const gpx = parser.parseFromString(gpxData, "application/xml");

    const trkseg = gpx.getElementsByTagName("trkseg")[0];
    const trkpts = Array.from(trkseg.children).map(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat'))
      const lng = parseFloat(trkpt.getAttribute('lon'))
      const ele = parseFloat(trkpt.getElementsByTagName('ele')[0]?.textContent)
      return { lat, lng, ele };
    });

    return trkpts

  } catch (error) {
    console.error('Error fetching the GPX file:', error);
  }
}



async function animateMarker(marker, from, to, duration) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const latDelta = to[0] - from[0];
    const lngDelta = to[1] - from[1];

    function updateMarker() {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentLat = from[0] + latDelta * progress;
      const currentLng = from[1] + lngDelta * progress;
      marker.setLatLng([currentLat, currentLng]);

      if (progress < 1) {
        requestAnimationFrame(updateMarker);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(updateMarker);
  });
}


async function animateMarkers(marker,from,to,duration){
  
  function getDurationsFromDestinations(duration,from,destinations){
    if(destinations.length === 1) return [duration]
    const loc = [from,...destinations]

    // Calculate cumulative distances
    const cumulativeDistances = loc.reduce((acc, point, index, array) => {
      if (index === 0) return acc;
      const distance = euclideanDistance(array[index - 1], point);
      acc.push(acc[acc.length - 1] + distance);
      return acc;
    }, [0]);
    
    // Total distance
    const totalDistance = cumulativeDistances.at(-1)
    
    // Calculate relative distances
    const relativeDistances = cumulativeDistances.flatMap((v,i,arr)=>{
      if(i===arr.length -1) return []
      return (arr[i+1] -v) / totalDistance
    })
    
    console.log("LOC",cumulativeDistances,totalDistance)
    console.log("REL",relativeDistances)
    console.log(relativeDistances.reduce((acc,v)=>acc+v))

    return relativeDistances.map(x=>x*duration)

  }

  const markers = Array.isArray(marker) ? marker : [marker]
  const destinations = Array.isArray(to[0]) ? to : [to]
  const froms = (() => {
    if (from) return Array.from({length:markers.length}).fill(from)
    
    return markers.map(x=>{
      const { lat, lng } = x.getLatLng()
      return [lat, lng]
    })
  })()
  const durations = Array.isArray(duration) ? duration : getDurationsFromDestinations(duration,froms[0],destinations)

  //ensure initial position
  markers.forEach((marker,i)=>marker.setLatLng(froms[i]))

  for (let i=0; i<destinations.length; i++) {
    const dest = destinations[i]
    
    const currentStage = markers.map((marker,j)=>{
      const from = i === 0 ? froms[j] : destinations[i-1]
      return animateMarker(marker,from,dest,durations[i])
    })

    
    await Promise.all(currentStage)
  }

}


function makeIcon(src,w,h,scale = 1){
  const icon = L.icon({
    iconUrl: src,
    iconSize: [w*scale, h*scale], 
    iconAnchor: [(w*scale)/2, (h*scale)/2]
  })

  return icon
}


function makeMarker(coords,zindex,...iconProps){
  const icon = makeIcon(...iconProps)
  const marker =  L.marker(coords, {icon})
  marker.zindex = zindex
  return marker
}