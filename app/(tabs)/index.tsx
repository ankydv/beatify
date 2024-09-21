import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import homeData from '@/sample/home'
import PlaylistRow from '@/components/PlaylistRow';
import { Text } from '@/components/Themed';

const HomeScreen = () => {

  return (
    <View style={styles.container}>
      <ScrollView>
        {homeData.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <PlaylistRow items={section.contents} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default HomeScreen;
