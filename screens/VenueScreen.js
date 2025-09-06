import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Modal, Image, Linking, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VenueScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venueDetails, setVenueDetails] = useState(null);
  const [venueReviews, setVenueReviews] = useState([]);
  const mapRef = useRef(null);
  const flatListRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  const { width: screenWidth } = Dimensions.get('window');
  const API_KEY = 'AIzaSyB-mlmjfKuW8xGfDM8q9y1YD4kymFvu1ug';

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      let locationData = await Location.getCurrentPositionAsync({});
      setLocation(locationData.coords);
      fetchNearbyVenues(locationData.coords.latitude, locationData.coords.longitude);
    })();
  }, []);

  const fetchNearbyVenues = async (lat, lng) => {
    try {
      const { data } = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&type=stadium,sports_complex&keyword=badminton,futsal,basketball,tennis,volleyball&key=${API_KEY}`
      );
      setVenues(data.results);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVenueDetails = async (placeId) => {
    try {
      const { data } = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,vicinity,rating,user_ratings_total,formatted_phone_number,website,opening_hours,photos,reviews&key=${API_KEY}`
      );
      setVenueDetails(data.result);
      setVenueReviews(data.result?.reviews?.slice(0, 10) || []);
    } catch (error) {
      console.error('Error fetching venue details:', error);
    }
  };

  const selectVenue = (index) => {
    setSelectedIndex(index);
    const venue = venues[index];
    if (venue) {
      setSelectedVenue(venue);
      mapRef.current?.animateToRegion({
        latitude: venue.geometry.location.lat,
        longitude: venue.geometry.location.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleVenuePress = (index) => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      fetchVenueDetails(venues[index].place_id);
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapTimeoutRef.current = null;
        selectVenue(index);
        flatListRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
      }, 300);
    }
  };

  const getPhotoUrl = (photoReference) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${API_KEY}`;
  };

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    viewableItems.length > 0 && selectVenue(viewableItems[0].index);
  }).current;

  if (loading || !location) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Finding sports venues near you...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker coordinate={location} title="You are here" pinColor="blue" />
        {venues.map((venue, index) => (
          <Marker
            key={index}
            coordinate={{
              latitude: venue.geometry.location.lat,
              longitude: venue.geometry.location.lng,
            }}
            title={venue.name}
            pinColor={index === selectedIndex ? "red" : "orange"}
            onPress={() => handleVenuePress(index)}
          />
        ))}
      </MapView>

      <SafeAreaView style={styles.safeAreaButtons} edges={['top']}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.cardContainer}>
        {venues.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={venues}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={screenWidth - 40}
            decelerationRate="fast"
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            onViewableItemsChanged={viewableItemsChanged}
            renderItem={({ item, index }) => (
              <TouchableOpacity 
                style={[styles.card, { width: screenWidth - 60 }]}
                onPress={() => handleVenuePress(index)}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardAddress}>{item.vicinity}</Text>
                {item.opening_hours && <Text style={styles.openNow}>{item.opening_hours.open_now ? 'Open Now' : 'Closed'}</Text>}
                {item.rating && (
                  <View style={styles.ratingContainer}>
                    <Text style={styles.rating}>Rating: {item.rating} ⭐</Text>
                    <Text>({item.user_ratings_total || 0} reviews)</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            getItemLayout={(_, index) => ({
              length: screenWidth - 40,
              offset: (screenWidth - 40) * index,
              index,
            })}
          />
        ) : (
          <View style={styles.noVenuesCard}>
            <Text style={styles.noVenuesText}>No ball sport venues found within 10km.</Text>
          </View>
        )}
      </View>

      {/* Venue Details Modal */}
      <Modal
        visible={!!venueDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setVenueDetails(null);
          setVenueReviews([]);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              {venueDetails?.photos?.[0]?.photo_reference && (
                <Image 
                  source={{ uri: getPhotoUrl(venueDetails.photos[0].photo_reference) }}
                  style={styles.modalImage}
                />
              )}
              <Text style={styles.modalTitle}>{venueDetails?.name}</Text>
              <Text style={styles.modalAddress}>{venueDetails?.vicinity}</Text>
              
              {venueDetails?.rating && (
                <Text style={styles.modalRating}>
                  Rating: {venueDetails.rating} ⭐ ({venueDetails.user_ratings_total || 0} reviews)
                </Text>
              )}
              
              {venueDetails?.formatted_phone_number && (
                <Text style={styles.modalText}>Phone: {venueDetails.formatted_phone_number}</Text>
              )}
              
              {venueDetails?.website && (
                <TouchableOpacity onPress={() => Linking.openURL(venueDetails.website)}>
                  <Text style={styles.modalLink}>Website</Text>
                </TouchableOpacity>
              )}
              
              {venueDetails?.opening_hours?.weekday_text && (
                <View style={styles.hoursContainer}>
                  <Text style={styles.hoursTitle}>Opening Hours:</Text>
                  {venueDetails.opening_hours.weekday_text.map((hour, index) => (
                    <Text key={index} style={styles.hoursText}>{hour}</Text>
                  ))}
                </View>
              )}

              {venueReviews.length > 0 && (
                <View style={styles.reviewsSection}>
                  <Text style={styles.sectionTitle}>User Reviews</Text>
                  {venueReviews.map((review, index) => (
                    <View key={index} style={styles.reviewItem}>
                      <View style={styles.reviewHeader}>
                        {review.profile_photo_url && (
                          <Image 
                            source={{ uri: review.profile_photo_url }} 
                            style={styles.reviewerImage} 
                          />
                        )}
                        <Text style={styles.reviewerName}>{review.author_name}</Text>
                        <Text style={styles.reviewRating}>{review.rating} ⭐</Text>
                      </View>
                      <Text style={styles.reviewText}>{review.text}</Text>
                      <Text style={styles.reviewTime}>{review.relative_time_description}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => {
                setVenueDetails(null);
                setVenueReviews([]);
              }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: StyleSheet.absoluteFillObject,
  safeAreaButtons: { position: 'absolute', top: 0, left: 0, right: 0 },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.7)', width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', margin: 15,
  },
  cardContainer: { position: 'absolute', bottom: 30, left: 0, right: 0 },
  card: {
    backgroundColor: 'white', borderRadius: 10, padding: 15, marginHorizontal: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25,
    shadowRadius: 3.84, elevation: 5,
  },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  cardAddress: { fontSize: 14, color: '#666', marginBottom: 8 },
  openNow: { fontSize: 14, color: 'green', marginBottom: 5 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  rating: { marginRight: 5, fontWeight: '500' },
  noVenuesCard: {
    backgroundColor: 'white', padding: 15, borderRadius: 10, marginHorizontal: 20,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },
  noVenuesText: { fontWeight: 'bold', fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  // Modal styles
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white', borderRadius: 10, padding: 20,
    width: '90%', maxHeight: '80%',
  },
  modalImage: {
    width: '100%', height: 200, borderRadius: 8, marginBottom: 15,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  modalAddress: { fontSize: 16, color: '#666', marginBottom: 10 },
  modalRating: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  modalText: { fontSize: 16, marginBottom: 5 },
  modalLink: {
    fontSize: 16, color: 'blue', marginBottom: 15,
    textDecorationLine: 'underline',
  },
  hoursContainer: { marginBottom: 15 },
  hoursTitle: { fontWeight: 'bold', marginBottom: 5 },
  hoursText: { marginBottom: 3 },
  closeButton: {
    backgroundColor: '#2196F3', padding: 12, borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: { color: 'white', fontWeight: 'bold' },
  // Review styles
  reviewsSection: {
    marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee',
    paddingTop: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  reviewItem: {
    marginBottom: 20, paddingBottom: 15,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewerImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  reviewerName: { fontWeight: 'bold', flex: 1 },
  reviewRating: { color: '#FFA500', fontWeight: 'bold' },
  reviewText: { fontSize: 14, lineHeight: 20, marginBottom: 5 },
  reviewTime: { fontSize: 12, color: '#888' },
});