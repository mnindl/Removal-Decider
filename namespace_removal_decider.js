google.load("jquery", "1.5.1");
google.load("jqueryui", "1.8.11");
google.load("maps", "3", {other_params: "sensor=false"});

if (!window.REMOVAL) { var REMOVAL = {}; }

google.setOnLoadCallback(function() {
  rooms = null;
  member = null;
  startLoc = null;
  endLoc = null;
  stop_area_region_start = null;
  stop_area_region_end = null;
  company_removal_address_street = null;
  company_removal_address_region = null;
  
  var directions_service = new google.maps.DirectionsService();
  var geocoder = new google.maps.Geocoder();
  var $error_box = $(".removal_decider .error_box");
  // input click
  $("#removal_form input:text").click( function () {
    $(this).removeClass("error").val("");
  });
  $("#removal_form .submit").click(function(event) {
    event.preventDefault();
    calculateRemoval();
  });
  
  // autocomplete
  $(".address").autocomplete({
    source: function(request, response) {
       // gewichtung der geocodierung auf Deutschland setzen
      var region_bound = new google.maps.LatLngBounds(new google.maps.LatLng(54.393352,10.415039 ),new google.maps.LatLng(14.332516,67.631836));
      var location = region_bound.getCenter();
      var geocode_request = {
        address: request.term + ', DE',
        region: 'de',
        language: 'de',
        bounds: region_bound,
        location: location
      };
      geocoder.geocode( geocode_request,
        function(results, status) {
          response($.map(results, function(item) {
            //console.log(item.formatted_address);
            if (item.formatted_address.search(/Bundesrepublik.+/) != -1) {
              return {
                label: item.formatted_address,
                value: item.formatted_address
              }
            }
         }));
       })
     }
   });
  //submit
  var calculateRemoval = function() {
    var start = $("#start").val();
    var end = $("#end").val();
    var route_request = {
      origin:start,
      destination:end,
      travelMode: google.maps.DirectionsTravelMode.DRIVING
    };
    member = parseInt($("#member").val());
    rooms = parseInt($("#rooms").val());
    if ( isNaN(member) || member.length == 0 ) {
      $("input#member").addClass("error").focus();
      $error_box.find("p").html("Bitte geben Sie die richtige Anzahl der Personen an").end().fadeIn("slow");
      return false;
    } else if ( isNaN(rooms) || rooms.length == 0 ) {
      $("input#rooms").addClass("error").focus();
      $error_box.find("p").html("Bitte geben Sie die richtige Anzahl der R&#228;ume an").end().fadeIn("slow");
      return false;
    } else {
       $("input#member").removeClass("error");
       $("input#rooms").removeClass("error");
    }
    directions_service.route(route_request, function(response, status) {
      if (status == google.maps.DirectionsStatus.OK) {
        $error_box.fadeOut();
        $(".error").removeClass("error");
        $(".removal_decider .removal_decider_form").find("#start").removeClass("error").end().find("#end").removeClass("error");
        var route = response.routes[0].legs[0];
        $("#start").val(route.start_address);
        $("#end").val(route.end_address);
        console.log(route.start_address);
        setRegion(route);
        var configJson = getJsonFile("removal_decider_config.json");
        var lkw_matrix_json = getJsonFile("lkw_rent_prices.json");
        var stop_area_matrix_json = getJsonFile("stop_area_prices.json");
        
        var orig_distance = getOrigDistance(route);
        $("#orig_distance").html(orig_distance);
        
        var removal_time = getRemovalTime(configJson, route, rooms);
        
        var lkw_rent_distance = getLKWRentDistance(lkw_matrix_json, orig_distance);
    
        var num_boxes = getNumBoxes(configJson);
        $("#num_boxes i").html(num_boxes);
        
        var price_boxes = parseFloat(getPriceBoxes(configJson, num_boxes));
        $("#price_boxes").html(getFormatPrice(price_boxes));
        
        var lkw_size = getLKWSize(configJson, num_boxes);
        var lkw_size_out = (lkw_size == "t7" ? "7,5t" : "3,5t" );
        
        $("#lkw_size").html(lkw_size_out);
        $("#lkw_rent_distance").html(""+lkw_rent_distance);
        
        var lkw_rent = parseInt(getLKWRent(lkw_matrix_json, lkw_rent_distance, lkw_size));
        $("#lkw_rent").html(getFormatPrice(lkw_rent));

        var fuel_price = parseFloat(getFuelPrice(configJson, orig_distance, lkw_size));
        $("#fuel_price").html(getFormatPrice(fuel_price));
        var mileage = (lkw_size == "t7" ? "15l" : "10l");
        $("#mileage").html(mileage);
        
        
        var stop_area_price_array = getStopAreaPrice(route, stop_area_matrix_json);
        var stop_area_price_sum = (parseInt(stop_area_price_array[0]) + parseInt(stop_area_price_array[1]));
        $("#stop_area_price").html(getFormatPrice(stop_area_price_sum));
        var stop_area_and = ( stop_area_region_start != null && stop_area_region_end != null ? " und " : "");
        $("#info_stop_area_price i").html((stop_area_region_start != null ? stop_area_region_start : "")+stop_area_and+(stop_area_region_end != null ? stop_area_region_end : ""));
        if (stop_area_price_sum == 0)
          $("#info_stop_area_price").html("Erfahrungsgem&#228;&#223; keine HVZ f&#252;r diese Orte");
        
        var catering_price = parseFloat(getCateringPrice(configJson, removal_time));
        $("#catering_price").html(getFormatPrice(catering_price));
        
        var sum = price_boxes+lkw_rent+fuel_price+stop_area_price_sum+catering_price;
        $("#sum .own_removal_val span").html(getFormatPrice(sum));
        $("#info_catering_price #cat_member").html(member);
        $("#info_catering_price #cat_helper").html(configJson.helper);
        
        var word_person = (member > 1)? " Personen" : " Person"
        $("#header_text_member").html(member + word_person + " von "+startLoc+" nach "+endLoc);
        $("#header_text_distance").html("Strecke: "+orig_distance+ " km");
        
        var date = new Date();
        $("#fake_datas_offer_val_date").html(date.getDate()+"."+(date.getMonth()+1)+"."+date.getFullYear());
        $("#fake_datas_add_street").html(company_removal_address_street);
        $("#fake_datas_add_region").html(company_removal_address_region);
        
        $(".removal_decider .offer").removeClass("hidden");
        $(".removal_decider .fake_datas").removeClass("hidden");
      } else if (status == google.maps.DirectionsStatus.NOT_FOUND) {
        $(".removal_decider .removal_decider_form").find("#start").addClass("error").focus().end().find("#end").addClass("error");
        $error_box.find("p").html("Geben Sie bitte einen g&#252;ltigen Startort und einen g&#252;ltigen Zielort ein.").end().fadeIn("slow");
      } else {
        $(".removal_decider .removal_decider_form").find("#start").addClass("error").focus().end().find("#end").addClass("error");
        $error_box.find("p").html("Leider liefert Google Maps kein Ergebnis zu ihrer Routenanfrage").end().fadeIn("slow");
      }
    });
  };
});
var getJsonFile = function(url) {
  var temp = null;
  $.ajax({
      type: "GET",
      url: url,
      dataType: "json",
      async: false,
      success: function(data){
        temp = data;
      }
  });
  return (temp);
}
var getOrigDistance = function(route){
  var temp = null;
  temp = route.distance.value;
  temp = parseInt(temp/1000);
  return(temp);
}
var getRemovalTime = function(configJson, route, rooms){
  var STATIC_drive_rest_time_in_sec = parseInt(configJson.drive_rest_time_in_sec);
  var STATIC_shipping_time_for_max_3_rooms_in_sec = parseInt(configJson.shipping_time_for_max_3_rooms_in_sec);//start and end 
  var STATIC_shipping_time_for_more_3_rooms_in_sec = parseInt(configJson.shipping_time_for_more_3_rooms_in_sec);//start and end
  var STATIC_room_limit = parseInt(configJson.room_limit);
  var temp = null;
  temp = route.duration.value;
  temp =  ((temp+STATIC_drive_rest_time_in_sec+( rooms > STATIC_room_limit ? STATIC_shipping_time_for_more_3_rooms_in_sec : STATIC_shipping_time_for_max_3_rooms_in_sec))/60)/60;
  temp = Math.round(temp);
  return(temp);
}
var getLKWRentDistance = function (lkw_matrix_json, orig_distance) {
  km = new Array();
  var temp = null;
  for (var key in lkw_matrix_json) {
    km.push(key.substring(1, key.length));
  }
  $(km).each( function() {
    if (orig_distance < this) { 
      temp = this;
      return false;
    }
  })
  if (temp == null)
    temp = "1000+";
  return (temp);
}
var getNumBoxes = function(configJson) {
  var STATIC_boxes_per_room = parseInt(configJson.boxes_per_room);
  var STATIC_boxes_per_member = parseInt(configJson.boxes_per_member);
  return (rooms*STATIC_boxes_per_room + member*STATIC_boxes_per_member);
}
var getPriceBoxes = function(configJson, num_boxes) {
  var STATIC_price_per_box = parseFloat(configJson.price_per_box);
  return (num_boxes*STATIC_price_per_box);
}
var getLKWSize = function(configJson, num_boxes) {
  var STATIC_small_lkw_num_boxes = parseInt(configJson.small_lkw_num_boxes);
  return(num_boxes > STATIC_small_lkw_num_boxes ? "t7" : "t3");
}
var getLKWRent = function(lkw_matrix_json, lkw_rent_distance, lkw_size) {
  var temp = null;
  temp = lkw_matrix_json['k' + lkw_rent_distance].rent[lkw_size];
  return (temp);
}
var getFuelPrice = function(configJson, orig_distance, lkw_size) {
  var STATIC_fuel_price_liter = parseFloat(configJson.fuel_price_liter);
  var STATIC_average_fuel_consum_1_km_t3 = parseFloat(configJson.average_fuel_consum_1_km_t3);
  var STATIC_average_fuel_consum_1_km_t7 = parseFloat(configJson.average_fuel_consum_1_km_t7);
  if (orig_distance < 10)
    orig_distance = 10;
    console.log(orig_distance*(lkw_size == "t3" ? STATIC_average_fuel_consum_1_km_t3 : STATIC_average_fuel_consum_1_km_t7 ));
  var average_fuel = parseInt(orig_distance*(lkw_size == "t3" ? STATIC_average_fuel_consum_1_km_t3 : STATIC_average_fuel_consum_1_km_t7 ));
  return (average_fuel*STATIC_fuel_price_liter);
}
var setRegion = function(route) {
  startLoc = route.start_address.split(",");
  console.log("startLoc.length "+startLoc.length);
  if (startLoc.length > 1){
    if (startLoc.length > 2){
      company_removal_address_street = jQuery.trim(startLoc[0]);
      company_removal_address_region = jQuery.trim(startLoc[1]);
    } else {
      company_removal_address_street = "Musterstrasse 1";
      company_removal_address_region = jQuery.trim(startLoc[0]);
    }
    startLoc = jQuery.trim(startLoc[startLoc.length -2].replace(/\d/g,""));
  } else 
    startLoc = jQuery.trim(startLoc[0]);
  endLoc = route.end_address.split(",");
  if (endLoc.length > 1) 
    endLoc = jQuery.trim(endLoc[endLoc.length -2].replace(/\d/g,""));
  else 
    endLoc = jQuery.trim(endLoc[0]);
}

var getStopAreaPrice = function(route, stop_area_matrix_json) {
  var temp  =  new Array();
  var start_price;
  var end_price
  if (stop_area_matrix_json[startLoc] != undefined) {
    start_price = stop_area_matrix_json[startLoc];
    stop_area_region_start = startLoc;
  } else 
    start_price = 0;
  if (stop_area_matrix_json[endLoc]!= undefined) {
    end_price = stop_area_matrix_json[endLoc];
    stop_area_region_end  = endLoc;
  } else 
    end_price = 0;
  temp.push(start_price);
  temp.push(end_price);
  return (temp);
}
var getCateringPrice = function(configJson, removal_time) {
  var temp = null;
  var STATIC_helper = parseInt(configJson.helper);
  var STATIC_cat_price_1_helper = parseFloat(configJson.cat_price_1_helper);
  var helper = STATIC_helper + member;
  temp = (removal_time)*(helper*STATIC_cat_price_1_helper);
  return (temp);
}
var getFormatPrice = function (price) {
    temp = parseInt(price * 100);
    temp = temp / 100;
    temp = temp.toFixed(2);
    temp = temp.replace(/\./,",");
    while(temp.match(/^(\d+)(\d{3}\b)/)) {
        temp = temp.replace(/^(\d+)(\d{3}\b)/, RegExp.$1 + '.' + RegExp.$2);
    }
    return (temp);
}

