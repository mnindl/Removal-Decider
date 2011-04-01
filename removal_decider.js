google.load("jquery", "1.5.1");
google.load("jqueryui", "1.8.11");
google.load("maps", "3", {other_params: "sensor=false"});

google.setOnLoadCallback(function() {
  rooms = null;
  member = null;
  var directions_service = new google.maps.DirectionsService();
  var geocoder = new google.maps.Geocoder();
  var $error_box = $(".removal_decider .error_box");
  // input click
  $("#removal_form input:text").click( function () {
    $(this).removeClass("error").val("");
  });
  $("#removal_form .submit").click(function() {
    calculateRemoval();
  });
  
  // autocomplete
  $(".address").autocomplete({
    source: function(request, response) {
       // gewichtung der geocodierung auf Deutschland setzen
      geocoder.geocode( {'address': request.term, 'region': 'de','language': 'de', 'bounds':new google.maps.LatLngBounds(new google.maps.LatLng(54.393352,10.415039 ),new google.maps.LatLng(14.332516,67.631836)) },
        function(results, status) {
          response($.map(results, function(item) {
            return {
              label: item.formatted_address,
              value: item.formatted_address
            }
         }));
       })
     }
   });
  //submit
  var calculateRemoval = function() {
    console.log("form submit");
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
      $(".removal_decider .removal_decider_form input#member").addClass("error");
      $error_box.find("p").html("Bitte geben Sie die richtige Anzahl der Personen an").end().removeClass("hidden");
      return false;
    } else if ( isNaN(rooms) || rooms.length == 0 ) {
      $(".removal_decider .removal_decider_form input#rooms").addClass("error");
      $error_box.find("p").html("Bitte geben Sie die richtige Anzahl der Räume an").end().removeClass("hidden");
      return false;
    }
    console.log("-----------> member "+member+" romms "+rooms);
    directions_service.route(route_request, function(response, status) {
      if (status == google.maps.DirectionsStatus.OK) {
        $error_box.addClass("hidden");
        $(".removal_decider .removal_decider_form").find("#start").removeClass("error").end().find("#end").removeClass("error");
        console.log(response);
        var route = response.routes[0].legs[0];
        console.log(route.start_address);
        $("#start").val(route.start_address);
        $("#end").val(route.end_address);
        console.log("Die Fahrt dauert "+route.duration.value);
        console.log("Die Entfernung ist "+route.distance.value);
        var configJson = getConfigJson();
        var lkw_matrix_json = getLKWMatrixJson();
        
        var orig_distance = getOrigDistance(route);
        $("#orig_distance").html(orig_distance);
        console.log("----->orig_distance  "+orig_distance);
        
        var removal_time = getRemovalTime(configJson, route, rooms);
        //$("#removal_time").html("Zeit des Umzugs (Fahrtzeit  (aufgerundet in Stunden ) + Be/Entladen (3 zimmer = 3 stunden * 2, größer = 4,5 *2  ))="+removal_time+" Stunden");
        console.log("----->removal_time  "+removal_time);
        
        var lkw_rent_distance = getLKWRentDistance(lkw_matrix_json, orig_distance);
        //$("#lkw_rent_distance").html("die LKW Miet Distanz ="+lkw_rent_distance+" km");
        console.log("----->lkw_rent_distance  "+lkw_rent_distance);
    
        var num_boxes = getNumBoxes(configJson);
        $("#num_boxes").html(num_boxes);
        console.log("----->num_boxes "+num_boxes);
        
        var price_boxes = parseFloat(getPriceBoxes(configJson, num_boxes));
        $("#price_boxes").html(price_boxes);
        console.log("----->price_boxes "+price_boxes);
        
        var lkw_size = getLKWSize(configJson, num_boxes);
        var lkw_size_out = (lkw_size == "t7" ? "7,5t" : "3,5t" );
        
        $("#lkw_size").html(lkw_size_out);
        console.log("----->lkw_size "+lkw_size_out);
        
        var lkw_rent = parseInt(getLKWRent(lkw_matrix_json, lkw_rent_distance, lkw_size));
        $("#lkw_rent").html(lkw_rent);
        console.log("----->lkw_rent  "+lkw_rent);

        var fuel_price = parseFloat(getFuelPrice(configJson, orig_distance, lkw_size));
        $("#fuel_price").html(fuel_price);
        var mileage = (lkw_size == "t7" ? "15l" : "10l");
        $("#mileage").html(mileage);
        console.log("----->fuel_price "+fuel_price);
        
        var stop_area_price_array = getStopAreaPrice(route);
        var stop_area_price_sum = (parseInt(stop_area_price_array[0]) + parseInt(stop_area_price_array[1]));
        $("#stop_area_price").html(stop_area_price_sum);
        console.log("----->start area price "+stop_area_price_array[0]+ " end area price "+stop_area_price_array[1]+" gesamt = "+ stop_area_price_sum);
        
        var catering_price = parseFloat(getCateringPrice(configJson, removal_time));
        $("#catering_price").html(catering_price);
        console.log("----->catering_price "+catering_price);
        
        var sum = price_boxes+lkw_rent+fuel_price+stop_area_price_sum+catering_price;
        $("#sum .own_removal_val span").html(sum);
        $("#header_sum span i").html(sum);
        
        
      } else if (status == google.maps.DirectionsStatus.NOT_FOUND) {
        $(".removal_decider .removal_decider_form").find("#start").addClass("error").end().find("#end").addClass("error");
        $error_box.find("p").html("Geben Sie bitte einen gültigen Startort und ein gültigen Zielort ein.").end().removeClass("hidden");
      } else {
        $(".removal_decider .removal_decider_form").find("#start").addClass("error").end().find("#end").addClass("error");
        $error_box.find("p").html("Leider liefert Google Maps kein Ergebnis zu ihrer Routenanfrage").end().removeClass("hidden");
      }
    });
  };
});
getConfigJson = function() {
  var temp = null;
  $.ajax({
      type: "GET",
      url: "removal_decider_config.json",
      dataType: "json",
      async: false,
      success: function(data){
        temp = data;
      }
  });
  return (temp);
}
getLKWMatrixJson = function() {
  var temp = null;
  $.ajax({
      type: "GET",
      url: "lkw_rent_prices.json",
      dataType: "json",
      async: false,
      success: function(data){
        temp = data;
      }
  });
  return (temp);
}
getOrigDistance = function(route){
  var temp = null;
  temp = route.distance.value;
  temp = parseInt(temp/1000);
  return(temp);
}
getRemovalTime = function(configJson, route, rooms){
  var STATIC_drive_rest_time_in_sec = parseInt(configJson.drive_rest_time_in_sec);
  var STATIC_shipping_time_for_max_3_rooms_in_sec = parseInt(configJson.shipping_time_for_max_3_rooms_in_sec);//start and end 
  var STATIC_shipping_time_for_more_3_rooms_in_sec = parseInt(configJson.shipping_time_for_more_3_rooms_in_sec);//start and end
  var STATIC_room_limit = parseInt(configJson.room_limit);
  var temp = null;
  temp = route.duration.value;
  console.log(temp);
  temp =  ((temp+STATIC_drive_rest_time_in_sec+( rooms > STATIC_room_limit ? STATIC_shipping_time_for_more_3_rooms_in_sec : STATIC_shipping_time_for_max_3_rooms_in_sec))/60)/60;
  temp = Math.round(temp);
  console.log(temp);console.log("in Stunden");
  return(temp);
}
getLKWRentDistance = function (lkw_matrix_json, orig_distance) {
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
getNumBoxes = function(configJson) {
  var STATIC_boxes_per_room = parseInt(configJson.boxes_per_room);
  var STATIC_boxes_per_member = parseInt(configJson.boxes_per_member);
  return (rooms*STATIC_boxes_per_room + member*STATIC_boxes_per_member);
}
getPriceBoxes = function(configJson, num_boxes) {
  var STATIC_price_per_box = parseFloat(configJson.price_per_box);
  return (num_boxes*STATIC_price_per_box);
}
getLKWSize = function(configJson, num_boxes) {
  var STATIC_small_lkw_num_boxes = parseInt(configJson.small_lkw_num_boxes);
  return(num_boxes > STATIC_small_lkw_num_boxes ? "t7" : "t3");
}
getLKWRent = function(lkw_matrix_json, lkw_rent_distance, lkw_size) {
  var temp = null;
  temp = lkw_matrix_json['k' + lkw_rent_distance].rent[lkw_size];
  return (temp);
}
getFuelPrice = function(configJson, orig_distance, lkw_size) {
  var STATIC_fuel_price_liter = parseFloat(configJson.fuel_price_liter);
  var STATIC_average_fuel_consum_1_km_t3 = parseFloat(configJson.average_fuel_consum_1_km_t3);
  var STATIC_average_fuel_consum_1_km_t7 = parseFloat(configJson.average_fuel_consum_1_km_t7);
  if (orig_distance == 0)
    orig_distance = 10;
  var average_fuel = parseInt(orig_distance*(lkw_size == "t3" ? STATIC_average_fuel_consum_1_km_t3 : STATIC_average_fuel_consum_1_km_t7 ));
  return (average_fuel*STATIC_fuel_price_liter);
}
getStopAreaPrice = function(route) {
   console.log("------->"+route.start_address);
   console.log("------->"+route.end_address);
  var temp  =  new Array();
  var startLoc;
  var endLoc;
  startLoc = route.start_address.split(",");
  startLoc = startLoc[startLoc.length -2].replace(/\d/g,"").trim();
  endLoc = route.end_address.split(",");
  endLoc = endLoc[endLoc.length -2].replace(/\d/g,"").trim();
  console.log("von "+startLoc +" nach "+ endLoc );
  $.ajax({
      type: "GET",
      url: "stop_area_prices.json",
      dataType: "json",
      async: false,
      success: function(data){
        var start_price = (data[startLoc] != undefined ? data[startLoc] : 0 );
        console.log("start_price="+start_price);
        var end_price = (data[endLoc]!= undefined ? data[endLoc] : 0 );
        console.log("end_price="+end_price);
        temp.push(start_price);
        temp.push(end_price);
        console.log(temp);
      }
  });
  console.log(temp);
  return (temp);
}
getCateringPrice = function(configJson, removal_time) {
  var temp = null;
  var STATIC_helper = parseInt(configJson.helper);
  var STATIC_cat_price_1_helper = parseFloat(configJson.cat_price_1_helper);
  var helper = STATIC_helper + member;
  temp = (removal_time)*(helper*STATIC_cat_price_1_helper);
  return (temp);
}
