//Store list of URLs that were visited to prevent double checking
url_visited = [];
$(window).scroll(function(){
    //Get element of article links in FB feed
    var containers = document.getElementsByClassName("_3ekx _29_4");
    var title;
    var link;
    var titleCollection;
    var linkCollection;
    for (var i = 0, l = containers.length; i < l; i++) {
        //Get list of title and link pairs
        titleCollection = containers[i].getElementsByClassName("_6lz _6mb _1t62 ellipsis");
        linkCollection = containers[i].getElementsByClassName("_52c6")
        if (linkCollection.length == 0 || titleCollection.length == 0) {
            continue;
        } else {
            title = titleCollection [0];
            link = linkCollection[0].href;
        }
        //TO-DO: Find a generic way to exclude non-news links instead of manually create a list
        if (!url_visited.includes(link) && (!link.includes('youtube.com') && !link.includes('t.me'))) {
            url_visited.push(link);
            processURL(link, title);
        }
    }
});

//Main function that takes in a url and output whether it is New or Old.
//TO-DO: Determine sentiment of news article, balanced argument(?) or classify if it is reliable
function processURL(url, title) {
    $.get(url, function(response) {
        const regex = /document.location.replace\("[^\)]*\)/gm;
        if (response.match(regex) != null){
            //Cleans up redirected article link
            var res = response.match(regex)[0].split("(")[1].replace(/\\/g,"").replace(")","").replace(/\"/g,"").replace('http://','https://');
            $.get(res, function(response){
                var web = $( '<div></div>' );
                web.html(response);
                //Might want to consider looping through this if not just 1 element
                var webDom = web.get(0)
                date_class = webDom.querySelectorAll('[class*="date"]');
                time_tag = webDom.querySelector('time');
                var dateFound = false;
                if (date_class.length > 0){
                    //TO-DO: Sometimes the first element found is not the date. 
                    //Find a better fix for this, see nintendosoup websites.
                    for (var i = 0, l = date_class.length; i < l; i++){
                        class_name = date_class[i];
                        if (!class_name.className.includes('non-date')){
                            var date_text = class_name.textContent;
                            //Handles months, hours ago, days ago, etc
                            if (date_text.includes(' ago')){
                                var agoOutput = processAgo(date_text.trim().toLowerCase());
                                implementFreshness(agoOutput, title);
                                dateFound = true;
                            } else {
                                var functionOutput = processDate(date_text.toLowerCase());
                                if (functionOutput != 'uncaptured') {
                                    implementFreshness(functionOutput, title);
                                    dateFound = true;
                                }
                                
                            }
                            break;
                        }
                    }
                //If no classes with date in its name, check if <time> tags are found
                } else if (time_tag != null) {
                    var time_tag_text = time_tag.textContent.trim().toLowerCase();
                    if (time_tag_text.length == 0) {
                        var time_tag_attr = time_tag.getAttribute("datetime").slice(0,10);
                        var timeTagOutput = processDate(time_tag_attr);
                        implementFreshness(timeTagOutput, title);
                        dateFound = true;
                    } else {
                        //Check for months, hours, days, seconds ago
                        if (time_tag_text.includes('ago')){
                            var timeTagAgoOutput = processAgo(time_tag_text);
                            implementFreshness(timeTagAgoOutput, title);
                            dateFound = true;
                        } else {
                            var functionTimeTagOutput = processDate(time_tag_text);
                            if (functionTimeTagOutput != 'uncaptured') {
                                implementFreshness(functionTimeTagOutput, title);
                                dateFound = true;
                            }
                            
                        }
                    }
                } 
                //If <time> tag not found as well, look in meta data.
                // Manually handles cases that can't be generalise at the moment by adding checks
                if (!dateFound) {
                    var name = "cXenseParse:recs:publishtime";
                    var name2 = "sailthru.date";
                    var property = "article:published_time";
                    var itemProp = "datePublished";
                    var publishtimeOutput;
                    var publishtime = "";
                    if (webDom.querySelector("meta[name='"+name+"']") != null) {
                        publishtime = webDom.querySelector("meta[name='"+name+"']").getAttribute("content").slice(0,10);
                    } else if (webDom.querySelector("meta[name='"+name2+"']") != null) {
                        publishtime = webDom.querySelector("meta[name='"+name2+"']").getAttribute("content").slice(0,10);
                    } else if (webDom.querySelector("meta[property='"+property+"']") != null) {
                        publishtime = webDom.querySelector("meta[property='"+property+"']").getAttribute("content").slice(0,10);
                    } else if (webDom.querySelector("meta[itemprop='"+itemProp+"']") != null) {
                        publishtime = webDom.querySelector("meta[itemprop='"+itemProp+"']").getAttribute("content").slice(0,10);

                    }
                    if (publishtime != "") {
                        publishtimeOutput = processDate(publishtime.slice(8,10) + '/' + publishtime.slice(5,7) + '/' + publishtime.slice(0,4));
                        implementFreshness(publishtimeOutput, title);
                    }
                }

            });
        }
    });
}

//Returns new or old based on today's date and date provided
function processDate(date_string) {
    var month;
    var day;
    var year;
    var monthValue;
    var monthDict = {
      january: 0,
      jan: 0,
      february: 1,
      feb: 1,
      march: 2,
      mar: 2,
      april: 3,
      apr: 3,
      may: 4,
      june: 5,
      jun: 5,
      july: 6,
      jul: 6,
      august: 7,
      aug: 7,
      september: 8,
      sep: 8,
      october: 9,
      oct: 9,
      november: 10,
      nov: 10,
      december: 11,
      dec: 11
    };
    //28/10/2018
    const regex_date_format1 = /\d{1,2}(\/|-)\d{1,2}(\/|-)\d{2,4}/gm;
    //28 October 2018
    const regex_date_format2 = /\d{1,2}\s\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b\s\d{4}/gm;
    //October 28 2018
    const regex_date_format3 = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b\s\d{1,2}\s\d{4}/gm;
    //October 28, 08:50 pm
    const regex_date_format4 = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b\s\d{1,2},\s\d{2}:\d{2}\s(?:am|pm)/gm;
    //October 28, 2018
    const regex_date_format5 = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b\s\d{1,2},\s\d{4}/gm;
    //28 oct 2018
    const regex_date_format6 = /\d{1,2}\s\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b\s\d{4}/gm;
    //oct 21, 2018
    const regex_date_format7 = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s\d{1,2},\s\d{4}/gm;
    //2018-10-01
    const regex_date_format8 = /\d{4}(\/|-)\d{1,2}(\/|-)\d{1,2}/gm;

    if (date_string.match(regex_date_format1) != null) {
        date_matched = date_string.match(regex_date_format1)[0];
        split_date = date_matched.split("/");
        day = split_date[0];
        month = split_date[1];
        year = split_date[2];

    } else if (date_string.match(regex_date_format2) != null) {
        date_matched = date_string.match(regex_date_format2)[0];
        split_date = date_matched.split(" ");
        day = split_date[0];
        month = split_date[1];
        year = split_date[2];

    } else if (date_string.match(regex_date_format3) != null) {
        date_matched = date_string.match(regex_date_format3)[0];
        split_date = date_matched.split(" ");
        day = split_date[1];
        month = split_date[0];
        year = split_date[2];

    } else if (date_string.match(regex_date_format4) != null) {
        date_matched = date_string.match(regex_date_format4)[0];
        split_date = date_matched.split(" ");
        //Consider how to handle this without year
        day = split_date[1].replace(",","");
        month = split_date[0];
        var todayDate = new Date();
        var todayYear = todayDate.getFullYear();
        var testDate = new Date(todayYear, monthDict[month], parseInt(day,10));
        if (testDate > todayDate) {
            year = todayYear - 1;
        } else {
            year = todayYear;
        }

    } else if (date_string.match(regex_date_format5) != null) {
        date_matched = date_string.match(regex_date_format5)[0];
        split_date = date_matched.split(" ");
        day = split_date[1].replace(",","");
        month = split_date[0];
        year = split_date[2];

    } else if (date_string.match(regex_date_format6) != null) {
        date_matched = date_string.match(regex_date_format6)[0];
        split_date = date_matched.split(" ");
        day = date_matched.slice(0,2);
        month = date_matched.slice(2).trim().slice(0,3);
        year = date_matched.slice(2).trim().slice(3).trim();

    } else if (date_string.match(regex_date_format7) != null) {
        date_matched = date_string.match(regex_date_format7)[0];
        split_date = date_matched.split(" ");
        day = split_date[1].replace(",","");
        month = split_date[0];
        year = split_date[2];

    } else if (date_string.match(regex_date_format8) != null){
        date_matched = date_string.match(regex_date_format8)[0];
        split_date = date_matched.split("-");
        day = split_date[2];
        month = split_date[1];
        year = split_date[0];

    } else {
        return "uncaptured"
    }

    if (month == null) {
        return "uncaptured"
    } else if (month.length <= 2) {
        monthValue = parseInt(month,10) - 1;
    } else {
        monthValue = monthDict[month];
    }
    var dateObj = new Date(parseInt(year, 10), monthValue, parseInt(day,10));
    var currentDate = new Date();
    var daysDiff = compareDates(dateObj, currentDate);
    //Threshold is 6months
    if (daysDiff > 180) {
        return "old"
    } else if (daysDiff > 30) {
        return "recent"
    } else {
        return "new"
    }
}

function processAgo(string) {
    var stringArr = string.split(' ')
    if (stringArr[1].includes('hour') || stringArr[1].includes('second') || stringArr[1].includes('day')) {
        return 'new'
    } else if (stringArr[1].includes('month')) {
        if (parseInt(stringArr[0],10)> 1 && parseInt(stringArr[0],10) < 6) {
            return 'recent'
        } else if (parseInt(stringArr[0],10) >= 6) {
            return 'old'
        } else {
            return 'new'
        }
    } else if (stringArr[1].includes('year')) {
        return 'old'
    }
}

//Decided to only show OLD tags as it is more useful
function implementFreshness(status, title) {
    switch (status) {
        case 'old':
            title.innerHTML += ' <span class="old">OLD</span>';
            break;
        // case 'new':
        //     title.innerHTML += ' <span class="new">NEW</span>';
        //     break;
        // case 'recent':
        //     title.innerHTML += ' <span class="recent">RECENT</span>';
        //     break;
    }

}

function compareDates(date1, date2) {
    //Get 1 day in milliseconds
    var one_day=1000*60*60*24;
    var date1_ms = date1.getTime();
    var date2_ms = date2.getTime();

    var difference_ms = date2_ms - date1_ms;
    return Math.round(difference_ms/one_day); 
}