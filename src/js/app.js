var ViewModel = function(){

	var self = this; // in this case, self is the View_Model
	var mapObj;
	self.filterLocStr = ko.observable('');
	self.selectedLoc =  ko.observable('');

	this.menuIsOpen = ko.observable(false);



	/* Initialize Neighborhood Information */
	self.street = ko.observable('1000 S La Grange Road');
	self.city = ko.observable('Orland Park');
	self.locations = ko.observableArray([]);
	self.filtered = ko.observableArray([]);
	self.map = ko.observable({
		lat: ko.observable(41.602631),
		lng: ko.observable(-87.853004)
	});
	self.address = ko.computed(function() {
		return self.street() + ', ' + self.city();
	},this);

	/* Initialize Map from Google Maps*/
	ko.bindingHandlers.map = {

	    init: function (element, valueAccessor, allBindingsAccessor, viewModel) {

	        var mapObj = ko.utils.unwrapObservable(valueAccessor());

	        var latLng = new google.maps.LatLng(
	            ko.utils.unwrapObservable(mapObj.lat),
	            ko.utils.unwrapObservable(mapObj.lng));

	        var mapOptions = { center: latLng,
	                          zoom: 12,
	                          mapTypeId: google.maps.MapTypeId.ROADMAP};

	        mapObj.googleMap = new google.maps.Map(element, mapOptions);

	        self.mapObj = mapObj.googleMap;

	        // Return locations according to the locInit
	        var locInit = ['park','restaurant'];

	        self.getLocations(mapObj.googleMap, latLng, locInit);
    	} // init
	}; // bindingHandlers.map



	/*************************** get locations ***/
	this.getLocations = function(map, latLng, searchStr){

		// Specify location, radius and place types for our Places API search.
	  	var request = {
	    	location: latLng,
	    	radius: '5000',
	    	types: searchStr
	  	};

		// Create the PlaceService and send the request.
	    // Handle the callback with an anonymous function.
	  	var service = new google.maps.places.PlacesService(map);
	  	var place;
	  	var marker;
	  	service.nearbySearch(request, function(results, status) {
	  		if (status == google.maps.places.PlacesServiceStatus.OK) {

				// Load Array locations with the result of the Search
		      	var location = ko.utils.arrayMap(results, function(place) {


		  			return {name: ko.observable(place.name),
				 			address: ko.observable(place.vicinity),
				 			position: place.geometry.location,
				 			marker: ko.observable(new google.maps.Marker({
			          									map: map,
			          									position: place.geometry.location,
			          									title: place.name ,
			          									vicinity:  place.vicinity,
			          									animation: null
			        								})),
				 			infoWindow: ko.observable(new google.maps.InfoWindow({
															content: place.name
															})),
				 			infoWindowStr: ko.observable(place.name),
				 			// visible: ko.observable(true),
				 			selected: ko.observable(false)};
		 			 		});


		  		self.locations(location);
				// add event listener for each marker
				for (var i = 0; i<self.locations().length; i++){
						var marker = self.locations()[i].marker();

						self.getAdditionalInfo(self.locations()[i]);

						marker.addListener('click', (function(markerCopy){
							return function(){
								self.selectLoc('2',markerCopy);
							};
						})(marker));
				}// for

				self.filtered(self.locations());
	    	} //if
		}); // nearbySearch
	}; // getLocations


	this.filterLoc = ko.pureComputed({
	    read: function() {
	    	this.filtered(this.locations());
	    	return true;
	    },
	    write: function(value) {
	    	var search = value.filterLocStr().toLowerCase();
	    	var filteredLocations = ko.utils.arrayFilter(value.locations(), function(loc) {
	    		var pos = loc.name().toLowerCase().indexOf(search);

	    		loc.selected(false);
				value.infoWindow(loc,'close');
				value.selectedLoc("");

	    		if (pos === -1) {
	    			loc.marker().setMap(null);
	    		} else {
	    			loc.marker().setMap(self.mapObj);
	    		}
	            return (pos !== -1);
	        });
	    	this.filtered(filteredLocations);

	        return true;
	    },
	    owner: this
	});

	this.openMenu = function() {
    	self.menuIsOpen(true);
	};

	this.closeMenu = function() {
	    self.menuIsOpen(false);
	};

		this.getAdditionalInfo = function(loc){

			// get additional info to put on the infowindow.
			var phoneStr = "";


		    var foursquareURL = 'https://api.foursquare.com/v2/venues/search?ll='+loc.position.lat()+','+ loc.position.lng()+ '&client_id=DTKUKGC3TBNDP52LDDPYIELISP5FVIVXY4G1RGS5TIM1IXNS&client_secret=IOXARMZ4DO4YMGG3XMDUH3UB5RRSBBFJEPKBUZYF14EU3TIO&v=20151213';
		    $.getJSON(foursquareURL, function(data) {

		        venues = data.response.venues;

		        if (typeof  venues[0].contact.formattedPhone === 'undefined') {
		        	phoneStr = '';
		        } else {
		        	phoneStr = '<br/>Phone: ' + venues[0].contact.formattedPhone;
		        }

				loc.infoWindowStr(loc.infoWindowStr() +  phoneStr);

		    }) .fail(function(err ) {
		            console.log( "Request Failed: " + err );
		            loc.infoWindowStr(loc.infoWindowStr() +  '<br/>foursquare info not available');
		        });

	};// getAdditionalInfo

	this.selectLoc = function(Origin,clickedItem){

		var loc;


	    switch (Origin) {
		    case '1': // clicked the loc list
	    		loc = clickedItem;
		        break;
		    case '2': // clicked the marker
	    		loc = self.getLoc(clickedItem);
		        break;
		}// switch

		// Highlight loc list
		self.highlightLoc(loc);

		// Bounce map marker
		self.toggleBounce(loc.marker());

		// Open InfoWindow
		self.infoWindow(loc,'open');

		// Checks if the selected location is different from the previous selected.
		// If so unmark the previous one

		if (self.selectedLoc() === "" ){
			self.selectedLoc(loc);
		} else {
			if (self.selectedLoc() === loc) {
				self.selectedLoc("");
			} else {
				self.highlightLoc(self.selectedLoc());
				self.toggleBounce(self.selectedLoc().marker());
				self.infoWindow(self.selectedLoc(),'close');
				self.selectedLoc(loc);
			}
		}
	};// selectLoc

	this.infoWindow = function(loc, action) {

		loc.infoWindow().setContent(loc.infoWindowStr());

		if (action == 'open'){
			loc.infoWindow().open(self.mapObj, loc.marker());
		}  	else {
			loc.infoWindow().close(self.mapObj, loc.marker());
		}
	}; // infoWindow


	// returns the location that has a specific marker
	this.getLoc = function(marker){
		var i;
		for (i = 0; i<self.locations().length; i++){
			if (self.locations()[i].marker() == marker){
				return self.locations()[i];
			}// if
		}// for
		return null;
	};// getLoc


    this.toggleBounce = function(marker) {
		if (marker.getAnimation() !== null) {
			marker.setAnimation(null);
		} else {
		    marker.setAnimation(google.maps.Animation.BOUNCE);
		//     window.setTimeout(function() {
  //           	marker.setAnimation(null);
  //       	}, 2100);
		}
	};// toggleBounce

	this.highlightLoc= function(loc) {

		if (loc.selected()) {
			loc.selected(false);
		} else {
			loc.selected(true);
		}
	};// highlightLoc


}; // ViewModel

function initMap() {
    ko.applyBindings(new ViewModel());
}

