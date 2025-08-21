import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FC } from 'react';
import type { Recipe } from '../reducers/favorites'; // adapte si centralisé ailleurs

// Navigation
type RootStackParamList = {
  Recipe: { recipe: Recipe; isFavorite?: boolean };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Recipe'>;

// Props du composant
type RecipeCardProps = {
  recipe: Recipe;
  isFavorite?: boolean;
};

const RecipeCard: FC<RecipeCardProps> = ({ recipe, isFavorite }) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('Recipe', { recipe, isFavorite })}
    >
      <View style={{ ...styles.wrapper, backgroundColor: recipe.color }}>
        <Image source={recipe.image} style={styles.image} resizeMode="contain" />
        <Text style={styles.title}>{recipe.name}</Text>
        <Text style={styles.subtitle}>{recipe.desc}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default RecipeCard;

const windowWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    padding: 10,
    width: windowWidth / 2 - 10,
    maxHeight: 250,
  },
  wrapper: {
    borderRadius: 25,
    borderBottomLeftRadius: 75,
    borderTopRightRadius: 50,
    display: 'flex',
    alignItems: 'flex-end',
    height: '100%',
    paddingTop: 6,
    paddingRight: 12,
    paddingLeft: 14,
    paddingBottom: 3,
  },
  image: {
    width: '95%',
    maxHeight: 150,
    alignSelf: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#655074',
    textAlign: 'right',
  },
  subtitle: {
    color: '#7e868f',
    fontSize: 10,
    textAlign: 'right',
  },
});
