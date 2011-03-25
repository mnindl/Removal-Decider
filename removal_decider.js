google.load("jquery", "1.5.1");
google.load("maps", "2");

google.setOnLoadCallback(function() {
  rooms = null;
  member = null;
  var dirn = new GDirections();
  $('#removal_form').submit(function(event) {
    console.log("form submit");
    event.preventDefault();
    var start = $("#start").val();
    var target = $("#target").val();
    member = parseInt($("#member").val());
    rooms = parseInt($("#rooms").val());
    if (isNaN(member) || member.length == 0 || isNaN(rooms) || rooms.length == 0  ) {
      alert("Bitte geben Sie die richtige Anzahl der Personen und die richtige Anzahl der Räume an");
      return false;
    }
    console.log("-----------> member "+member+" romms "+rooms);
    dirn.clear();
    var load_direction = "from: "+start+" to: "+target;
    dirn.load(load_direction);
  });
  GEvent.addListener(dirn,"error", function() {
    alert("Einer der eingegbenen Orte wurde nicht gefunden.Sie müssen einen gültigen Ort + Adresse oder Plz angeben");
    console.log("Failed: "+dirn.getStatus().code);
  });
  GEvent.addListener(dirn,"load", function() {
    console.log(dirn);
    console.log("The Fahrt dauert is "+dirn.getDuration().seconds);
    console.log("The distance is "+dirn.getDistance().meters);
    var configJson = getConfigJson();
    var lkw_matrix_json = getLKWMatrixJson();
    
    var orig_distance = getOrigDistance(dirn);
    $("#orig_distance").html("Die Distanz "+orig_distance+" km");
    console.log("----->orig_distance  "+orig_distance);
    
    var removal_time = getRemovalTime(configJson, dirn, rooms);
    $("#removal_time").html("Zeit des Umzugs (Fahrtzeit  (aufgerundet in Stunden ) + Be/Entladen (3 zimmer = 3 stunden * 2, größer = 4,5 *2  ))="+removal_time+" Stunden");
    console.log("----->removal_time  "+removal_time);
    
    var lkw_rent_distance = getLKWRentDistance(lkw_matrix_json, orig_distance);
    $("#lkw_rent_distance").html("die LKW Miet Distanz ="+lkw_rent_distance+" km");
    console.log("----->lkw_rent_distance  "+lkw_rent_distance);
    
    var num_boxes = getNumBoxes(configJson);
    $("#num_boxes").html("Anzahl der Kartons ( pro zimmer = 15 + pro mitglied = 4) ="+num_boxes);
    console.log("----->num_boxes "+num_boxes);
    
    var price_boxes = parseFloat(getPriceBoxes(configJson, num_boxes));
    $("#price_boxes").html("Preis der Kartons ( Preis pro Box = 1.50 € * anzahl der Boxen)  ="+price_boxes+"€");
    console.log("----->price_boxes "+price_boxes);
    
    var lkw_size = getLKWSize(configJson, num_boxes);
    $("#lkw_size").html("benötigte LKW Größe ( anzahl der boxen < 44 = 3,5T LKW ansonsten 7,5T LKW ) = "+lkw_size);
    console.log("----->lkw_size "+lkw_size);
    
    var lkw_rent = parseInt(getLKWRent(lkw_matrix_json, lkw_rent_distance, lkw_size));
    $("#lkw_rent").html("die LKW Miete (ermittelt aus LKW Matrix anhand der LKW Miet Distanz und der LKW Größe ) ="+lkw_rent+"€");
    console.log("----->lkw_rent  "+lkw_rent);
    
    var fuel_price = parseFloat(getFuelPrice(configJson, orig_distance, lkw_size));
    $("#fuel_price").html("der Dieselpreis für die Umzugsstrecke ( die Distanz in km * den verbrauch des lkws pro km  ) ="+fuel_price+"€");
    console.log("----->fuel_price "+fuel_price);
    
    var stop_area_price_array = getStopAreaPrice(dirn.getRoute(0));
    var stop_area_price_sum = (parseInt(stop_area_price_array[0]) + parseInt(stop_area_price_array[1]));
    $("#stop_area_price").html("der gesamte Halteverbotspreis anhand einer Preistabelle für die 30 größten Städte Deutschlands ="+ stop_area_price_sum+"€");
    console.log("----->start area price "+stop_area_price_array[0]+ " target area price "+stop_area_price_array[1]+" gesamt = "+ stop_area_price_sum);
     
    var catering_price = parseFloat(getCateringPrice(configJson, removal_time));
    $("#catering_price").html("Verpflegungskosten (2.50 € pro mitglied und helfer * umzugszeit) ="+catering_price+"€");
    console.log("----->catering_price "+catering_price);
    
    console.log("dirn routes= "+dirn.getNumRoutes());
    
    $("#sum").html("Gesamtpreis = "+(price_boxes+lkw_rent+fuel_price+stop_area_price_sum+catering_price)+"€");
  }); 
  $("#removal_form input:text").click( function () {
    $(this).val("").unbind("click");
  });
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
getOrigDistance = function(dirn){
  var temp = null;
  temp = dirn.getDistance().meters;
  temp = parseInt(temp/1000);
  return(temp);
}
getRemovalTime = function(configJson, dirn, rooms){
  var STATIC_drive_rest_time_in_sec = parseInt(configJson.drive_rest_time_in_sec);
  var STATIC_shipping_time_for_max_3_rooms_in_sec = parseInt(configJson.shipping_time_for_max_3_rooms_in_sec);//start and target 
  var STATIC_shipping_time_for_more_3_rooms_in_sec = parseInt(configJson.shipping_time_for_more_3_rooms_in_sec);//start and target
  var STATIC_room_limit = parseInt(configJson.room_limit);
  var temp = null;
  temp = dirn.getDuration().seconds;
  temp =  Math.round(((temp+STATIC_drive_rest_time_in_sec+( rooms > STATIC_room_limit ? STATIC_shipping_time_for_more_3_rooms_in_sec : STATIC_shipping_time_for_max_3_rooms_in_sec))/60)/60);
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
getStopAreaPrice = function(g_route) {
  console.log(g_route.getSummaryHtml());
   console.log("------->"+g_route.getStartGeocode().address );
   console.log("------->"+g_route.getEndGeocode().address );
  var temp  =  new Array();
  var startLoc;
  var targetLoc;
  startLoc = g_route.getStartGeocode().address.split(",");
  startLoc = startLoc[startLoc.length -2].replace(/\d/g,"").trim();
  targetLoc = g_route.getEndGeocode().address.split(",");
  targetLoc = targetLoc[targetLoc.length -2].replace(/\d/g,"").trim();
  console.log("von "+startLoc +" nach "+ targetLoc );
  $.ajax({
      type: "GET",
      url: "stop_area_prices.json",
      dataType: "json",
      async: false,
      success: function(data){
        var start_price = (data[startLoc] != undefined ? data[startLoc] : 0 );
        console.log("start_price="+start_price);
        var target_price = (data[targetLoc]!= undefined ? data[targetLoc] : 0 );
        console.log("target_price="+target_price);
        temp.push(start_price);
        temp.push(target_price);
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
