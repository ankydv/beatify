import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { getHome } from '@/services/explore.service';
import PlaylistRow from '@/components/PlaylistRow';
import QuickPicks from '@/components/QuickPicks';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { ActivityIndicator, Text } from 'react-native-paper';

const HomeScreen = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const homeData = await getHome();
        setData(homeData);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (error) {
      Alert.alert('Error', error)
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading && <ActivityIndicator />}
      <ScrollView>
        {data?.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text variant='titleLarge' style={styles.sectionTitle}>{section.title}</Text>
            {section.title !== 'Quick picks' ? (
              <PlaylistRow items={section.contents} title={section.title.toLowerCase()}/>
            ) : (
              <QuickPicks data={section.contents} />
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
    fontWeight: 'bold',
    marginLeft: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
