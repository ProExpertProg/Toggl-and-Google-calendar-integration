// query string
function serialize( obj ) {
  return '?'+Object.keys(obj).reduce(function(a,k){a.push(k+'='+encodeURIComponent(obj[k]));return a},[]).join('&')
}

function readableDateDifference(date1,date2){
  // Make a fuzzy time
  var delta = Math.round((date1 - date2) / 1000);
  
  var minute = 60,
      hour = minute * 60,
        day = hour * 24,
          week = day * 7;
  
  var fuzzy;
  
  /*if (delta < 30) {
  fuzzy = 'just then.';
  } else */
  if (delta < minute)
    fuzzy = delta + ' seconds ago.';
  else if (delta < 2 * minute)
    fuzzy = 'a minute ago.';
  else if (delta < hour)
    fuzzy = Math.floor(delta / minute) + ' minutes ago.';
  else if (Math.floor(delta / hour) == 1)
    fuzzy = '1 hour ago.';
  else if (delta < day)
    fuzzy = Math.floor(delta / hour) + ' hours ago.';
  else if (delta < day * 2)
    fuzzy = 'yesterday';
  else
    fuzzy = "long ago";
  
  return fuzzy;
}

function createDescription(entry) {
  return "Project: " + entry.project;
}

function failableOperation(callback) {
  var success = false;
  while(!success){
    try {
      callback();
      success = true;
    } catch (e) {
      Logger.log(e);
      Logger.log("Google Calendar API operation failed. Retrying...");
      Utilities.sleep(5000); // Calendar API restrictions
      success = false;
    }
  }
}
