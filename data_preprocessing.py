# Gerekli kütüphanelerin import edilmesi
import pandas as pd
import numpy as np
from collections import Counter
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
import re # Metin temizleme için regular expression kütüphanesi
import joblib # Model ve diğer nesneleri kaydetmek için
import os # Dizin oluşturmak için


# --- Veri Yükleme ---
# Veri setinin bulunduğu dosya yolu (Bu dosyanın kodla aynı dizinde olduğu varsayılır)
data_file = 'market_data.csv' # CSV dosyasının adı
output_dir = 'processed_data' # İşlenmiş verilerin ve nesnelerin kaydedileceği dizin

# Dizin yoksa oluştur
os.makedirs(output_dir, exist_ok=True)

print(f"{data_file} dosyası okunuyor...")
try:
    # CSV dosyasını pandas DataFrame olarak oku
    # Not: Eğer dosya farklı bir kodlama ile kaydedilmişse (örn: 'iso-8859-9' veya 'windows-1254'), encoding parametresi eklenmelidir.
    # df = pd.read_csv(data_file, encoding='utf-8') # veya 'iso-8859-9', 'windows-1254'
    df = pd.read_csv(data_file)
    print("Veri başarıyla yüklendi.")
    print("Veri setinin ilk 5 satırı:")
    print(df.head())
    print(f"\nVeri setinin boyutu: {df.shape}")
except FileNotFoundError:
    print(f"Hata: {data_file} dosyası bulunamadı. Lütfen dosyanın doğru yolda olduğundan emin olun.")
    exit() # Dosya yoksa programdan çık
except Exception as e:
    print(f"Veri okunurken bir hata oluştu: {e}")
    print("Dosya kodlamasını (encoding) kontrol etmeniz gerekebilir. Örn: encoding='utf-8' veya encoding='iso-8859-9'")
    exit()

# --- Veri Kontrolü ve Temizleme ---
print("\nEksik veri kontrolü yapılıyor...")
# Eksik değerleri kontrol et
print(df.isnull().sum())
# Eğer eksik değer varsa, bunları doldurabilir veya satırları silebiliriz.
# Bu örnekte eksik değer içeren satırları silelim (varsa)
df.dropna(subset=['item_name', 'category_name'], inplace=True)
print("Eksik değerler (varsa) temizlendi.")
print(f"Temizlenmiş veri setinin boyutu: {df.shape}")

# --- Metin Ön İşleme Fonksiyonu ---
# Türkçe karakterleri ve temel metin temizliğini içeren fonksiyon
def preprocess_text(text):
    # Gelen verinin string olduğundan emin olalım
    if not isinstance(text, str):
        text = str(text)
    # Küçük harfe çevirme
    text = text.lower()
    # Sayıları ve noktalama işaretlerini boşlukla değiştirme (kelimelerin birleşmesini önlemek için)
    text = re.sub(r'[^a-zçğıöşü\s]', ' ', text) # Sadece Türkçe harfler ve boşluk kalsın
    text = re.sub(r'\d+', ' ', text) # Sayıları boşlukla değiştir (yukarıdaki regex bunu zaten yapıyor ama garanti olsun)
    # Ekstra boşlukları tek boşluğa indirgeme
    text = re.sub(r'\s+', ' ', text).strip()
    return text

print("\n'item_name' sütunu için metin ön işleme uygulanıyor...")
# 'item_name' sütununa ön işleme fonksiyonunu uygula
df['processed_item_name'] = df['item_name'].apply(preprocess_text)
print("Metin ön işleme tamamlandı. İşlenmiş metin örneği:")
print(df[['item_name', 'processed_item_name']].head())

# --- Özellik Çıkarımı (TF-IDF) ---
print("\nTF-IDF vektörizasyonu yapılıyor...")
# TF-IDF Vectorizer nesnesi oluşturma
# max_features: En sık geçen N kelimeyi dikkate al (isteğe bağlı, performansı etkileyebilir)
# ngram_range: Tekli kelimeler (1,1) veya ikili kelime grupları (1,2) gibi n-gram'ları kullan
# analyzer='char_wb': Karakter seviyesinde n-gram kullanmak bazen kelime hatalarına karşı daha dirençli olabilir.
# Ancak genellikle 'word' daha iyi sonuç verir. Şimdilik 'word' kullanalım.
tfidf_vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))

# 'processed_item_name' sütununu kullanarak TF-IDF matrisini oluştur ve eğit
X = tfidf_vectorizer.fit_transform(df['processed_item_name'])
print("TF-IDF matrisi oluşturuldu.")
print(f"Özellik matrisinin boyutu (X): {X.shape}")

# TF-IDF Vectorizer nesnesini kaydet
vectorizer_path = os.path.join(output_dir, 'tfidf_vectorizer.joblib')
joblib.dump(tfidf_vectorizer, vectorizer_path)
print(f"TF-IDF Vectorizer '{vectorizer_path}' olarak kaydedildi.")

# --- Hedef Değişkeni Kodlama (Label Encoding) ---
print("\n'category_name' sütunu için etiket kodlama yapılıyor...")
# LabelEncoder nesnesi oluşturma
label_encoder = LabelEncoder()

# 'category_name' sütununu sayısal değerlere dönüştür ve eğit
y = label_encoder.fit_transform(df['category_name'])
print("Etiket kodlama tamamlandı.")
print(f"Kodlanmış etiket (y) örnekleri: {y[:5]}")
print(f"Toplam kategori sayısı: {len(label_encoder.classes_)}")
# print(f"Kategori isimleri ve kodları: {dict(zip(label_encoder.classes_, label_encoder.transform(label_encoder.classes_)))}") # Çok fazla kategori varsa yazdırmak sorun olabilir

# LabelEncoder nesnesini kaydet
encoder_path = os.path.join(output_dir, 'label_encoder.joblib')
joblib.dump(label_encoder, encoder_path)
print(f"Label Encoder '{encoder_path}' olarak kaydedildi.")

print("\nAz örnekli kategoriler filtreleniyor...")
# Kategorilerin örnek sayısını kontrol et
category_counts = Counter(y)
print(f"Kategori başına örnek sayıları: {category_counts.most_common(10)}")  # En yoğun 10 kategoriyi göster
print(f"Sadece 1 örneğe sahip kategori sayısı: {sum(1 for count in category_counts.values() if count == 1)}")

# En az 2 örneğe sahip kategorileri içeren maskeyi oluştur
valid_categories_mask = np.isin(y, [cat for cat, count in category_counts.items() if count >= 2])
print(f"Çok az örneğe sahip kategoriler kaldırıldıktan sonra kalan örnek sayısı: {sum(valid_categories_mask)}")
print(f"Kaldırılan örnek sayısı: {len(y) - sum(valid_categories_mask)}")

# Sadece geçerli kategorilere sahip örnekleri seç
X_filtered = X[valid_categories_mask]
y_filtered = y[valid_categories_mask]

# --- Veriyi Eğitim ve Test Setlerine Ayırma ---
print("\nVeri eğitim ve test setlerine ayrılıyor...")
# Veriyi %80 eğitim, %20 test olarak ayır
# stratify=y_filtered: Kategorilerin dağılımını eğitim ve test setlerinde benzer tutar (önemli!)
X_train, X_test, y_train, y_test = train_test_split(X_filtered, y_filtered, test_size=0.2, random_state=42, stratify=y_filtered)

print("Veri başarıyla ayrıldı.")
print(f"Eğitim seti boyutu (X_train): {X_train.shape}")
print(f"Test seti boyutu (X_test): {X_test.shape}")
print(f"Eğitim seti etiket boyutu (y_train): {y_train.shape}")
print(f"Test seti etiket boyutu (y_test): {y_test.shape}")

# Eğitim ve test setlerini kaydet (sparse matrix olarak kaydedilecekler)
train_data_path = os.path.join(output_dir, 'train_data.joblib')
test_data_path = os.path.join(output_dir, 'test_data.joblib')
joblib.dump({'X_train': X_train, 'y_train': y_train}, train_data_path)
joblib.dump({'X_test': X_test, 'y_test': y_test}, test_data_path)
print(f"Eğitim verisi '{train_data_path}' olarak kaydedildi.")
print(f"Test verisi '{test_data_path}' olarak kaydedildi.")

print("\nVeri ön işleme tamamlandı ve gerekli dosyalar kaydedildi.")
print(f"İşlenmiş veriler ve nesneler '{output_dir}' dizinine kaydedildi.")

