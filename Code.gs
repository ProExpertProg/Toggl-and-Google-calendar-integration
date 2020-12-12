/* --------------- HOW TO INSTALL ---------------
*
* 1) Click in the menu "File" > "Make a copy..." and make a copy to your Google Drive.
* 2) Customize settings (lines 18-20)
* 3) Click in the menu "Run" > "Run function" > "Install" and authorize the program
*    (For steps to follow in authorization, see this video: https://youtu.be/_5k10maGtek?t=1m22s )
* 
*
* - IF A FUNCTION IS RUNNING TOO LONG IT IS BECAUSE GOOGLE CALENDAR API LIMITS TRAFFIC. JUST WAIT FOR THE SCRIPT TO COMPLETE.
* - To stop the script from running repetitively run Deinstall (under "Run" > "Run function" > "Deinstall").
* - The script can also be manually run ("Run" > "Run function" > "main")
* - If the script failed, you have to clear the cache by running ClearCache
* - There is also a helper function ClearAllEvents which will truncate the calendar. 
*/

// --------------- SETTINGS ---------------

var apiToken = ""; // Your Toggl API Token (can be found under Profile Settings).
var targetCalendarName = "Toggl" // The name of the Google Calendar you want to add events to (will be created automatically if it doesn't exist).
var howFrequent = 5; //What interval (minutes) to run this script on to check for new events - one of 1, 5, 10, 15 or 30.

// ----------------------------------------

/* --------------- MISCELLANEOUS ----------
* 
* Created by Luka Govedič
* Github: https://github.com/ProExpertProg/Toggl-and-Google-calendar-integration
* LinkedIn: https://www.linkedin.com/in/luka-govedic/
*
* Inspiration was taken from https://script.google.com/d/1QeZFLSM1EkuFvYcryECI_xH-IZVe1-IxGRq_n6OoXp1CmVtSeTeigEx4/edit
*/



//---------------- DO NOT EDIT BELOW HERE UNLESS YOU REALLY KNOW WHAT YOU'RE DOING --------------------

var LAST_RUN_TIME_KEY = "last_run_time";
var API_TOKEN_KEY = "api_token";
function Install(){
  ClearCache();
  ScriptApp.newTrigger("main").timeBased().everyMinutes(howFrequent).create();
  
}

function Deinstall(){
  ScriptApp.getProjectTriggers().forEach(function(trigger){
    ScriptApp.deleteTrigger(trigger);
  });
}

function ClearCache(){
  PropertiesService.getUserProperties().deleteProperty(LAST_RUN_TIME_KEY);
}

// WARNING: will need a long time due to calendar api limitations
function ClearAllEvents() {
  var today = new Date;
  var lastYear = new Date(today);
  lastYear.setYear(today.getYear()-1);
  var targetCalendar = CalendarApp.getCalendarsByName(targetCalendarName)[0];
  
  if(targetCalendar != null){ 
    var calendarEvents = targetCalendar.getEvents(lastYear, today);
    Logger.log(calendarEvents);
    calendarEvents.forEach(function(event){
      failableOperation(function(){
        event.deleteEvent();        
      });
    });
  }
}

// WARNING: will need a while when run for the first time due to calendar api frequency limitation.
function main(){
  
  //----------------Fetch-workspaces------------------------
  
  var base64auth = Utilities.base64Encode(apiToken + ":api_token");
  var params = {
    headers: {
      "Authorization": "Basic " + base64auth
    }
  };
  
  
  var workspaces = "https://www.toggl.com/api/v8/workspaces"
  var response = UrlFetchApp.fetch(workspaces, params);
  var workspaces = JSON.parse(response.getContentText());
  
  //--------------------Dates------------------------
  
  var today = new Date;
  var lastYear = new Date(today);
  lastYear.setYear(today.getYear()-1);
  
  var props = PropertiesService.getUserProperties();
  var lastRunTime = props.getProperty(LAST_RUN_TIME_KEY);
  lastRunTime = lastRunTime ? new Date(lastRunTime) : lastYear;
  props.setProperty(LAST_RUN_TIME_KEY, today.toISOString());
  
  Logger.log("Script last ran " + readableDateDifference(today,lastRunTime) + " ("+lastRunTime+")");
  
  //---------------Fetch-time-entries------------------------
  
  var timeEntries = [];
  
  workspaces.forEach(function(workspace){
    Logger.log("Entries for workspace "+ workspace.name +" (" +workspace.id+")");
    
    var urlParams = {
      user_agent:"browser",
      workspace_id:workspace.id,
      since: lastYear.toISOString().split('T')[0] // just the date
    }
    
    var base_url = "https://toggl.com/reports/api/v2/details";
    
    //Get URL items
    response = UrlFetchApp.fetch(base_url + serialize(urlParams), params);
    var json = JSON.parse(response.getContentText());
    //Logger.log(json);
    //Logger.log(json.data);
    var data = json.data;
    Logger.log(" - total: " + json.total_count);
    Logger.log(" - per_page: " + json.per_page);
    
    if(json.total_count > json.per_page){
      for(var i = 1; i < json.total_count /json.per_page;) {
        urlParams.page = ++i;
        response = UrlFetchApp.fetch(base_url + serialize(urlParams), params);
        json = JSON.parse(response.getContentText());
        Array.prototype.push.apply(data, json.data);
      }
    }
    Logger.log(" - data len: " + data.length);
    
    timeEntries.push.apply(timeEntries, data);
  });
  
  Logger.log("All time entries length: " + timeEntries.length);
  var colors = {};
  var timeEntriesById = {};
  timeEntries.forEach(function(item){
    if(item.project_color != 0)
      colors[item.project] = item.project_color;
    timeEntriesById[item.id] = item;
  });
  
  if(Object.keys(timeEntriesById).length != timeEntries.length)
    throw Error("Overlapping ids");
  
  //Logger.log(timeEntries[0]);
  //Logger.log(colors);
  
  //----------------Fetch-events------------------------
  
  var targetCalendar = CalendarApp.getCalendarsByName(targetCalendarName)[0];
  
  if(targetCalendar == null){
    Logger.log("Creating Calendar: "+targetCalendarName);
    targetCalendar = CalendarApp.createCalendar(targetCalendarName);
  }
  
  
  //Logger.log(lastYear);
  //Logger.log(today);
  var calendarEvents = targetCalendar.getEvents(lastYear, today);
  Logger.log("All calendar events length: " + calendarEvents.length);
  var calendarEventsById = {};
  
  calendarEvents.forEach(function(event){
    var tag = event.getTag("TimeEntryID");
    //Logger.log("tag: " + tag);
    if(tag)
      calendarEventsById[tag] = event;
    else {
      Logger.log("Deleting an untagged event: "+event.getTitle()+" ("+tag+")");
      
      failableOperation(function(){
        event.deleteEvent();        
      });
    }
  });
  
  //------------Add-and-modify-calendar-events-----------------
  
  
  Object.keys(timeEntriesById).forEach(function(entryId){
    var entry = timeEntriesById[entryId];
    if (!calendarEventsById.hasOwnProperty(entryId)){
      var resultEvent;
      failableOperation(function(){
        resultEvent = targetCalendar.createEvent(entry.description, new Date(entry.start), new Date(entry.end), {description : createDescription(entry)});
      });
      resultEvent.setTag("TimeEntryID", entryId);
      Logger.log("Created: "+entry.description+" ("+entryId+")");
      
    } else {
      // calendar event exists
      var event = calendarEventsById[entryId];
      if(new Date(entry.updated) > lastRunTime && new Date(entry.updated) > event.getLastUpdated()) {
        Logger.log("Updating: " + entry.description +" ("+entryId+")") 
        if(event.getDescription() != createDescription(entry))
        event.setDescription(createDescription(entry));
        
        if(event.getStartTime() - new Date(entry.start) ||
          event.getEndTime() - new Date(entry.end))
          event.setTime(new Date(entry.start),new Date(entry.end));
        
        if(event.getTitle() != entry.description)
          event.setTitle(entry.description);
      }
      
      delete calendarEventsById[entryId]; // We don't need the event anymore 
    }
  });
  
  //-----------------Remove-calendar-events--------------------
  
  //All existing events in the object now have no corresponding time entry (those who do were deleted from the object)/
  Object.keys(calendarEventsById).forEach(function(entryId){
    var event = calendarEventsById[entryId];
    Logger.log("Deleting: " + event.getTitle() +" ("+entryId+")");
    
    failableOperation(function(){
      event.deleteEvent();
    });
  });
}
