import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { BusinessConfig, Category, Product, BusinessDay, UserProfile } from '../types';
import { cacheLocalProducts, cacheLocalCategories } from './offlineManager';

export async function initializeDatabase(currentUser?: { uid: string; email?: string; displayName?: string }) {
  try {
    // 1. Check/Create Business Config
    const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
    const bizSnap = await getDoc(bizRef);
    if (!bizSnap.exists()) {
      const defaultBiz: BusinessConfig = {
        id: DEFAULT_BUSINESS_ID,
        name: "Raphajoy Chemist & Pharmacy",
        phone: "+254 722 000 111",
        location: "Nairobi, Kenya",
        address: "Main Street, Medical Plaza, Nairobi",
        currency: "KSh",
        openingTime: "08:00",
        closingTime: "21:00",
        lowStockThreshold: 5,
        receiptHeader: "RAPHAJOY CHEMIST & PHARMACY\nLicensed Prescription & Health Care",
        receiptFooter: "Get Well Soon! Thank you for choosing Raphajoy.",
        tillNumber: "888999"
      };
      await setDoc(bizRef, defaultBiz);
    } else {
      const currentData = bizSnap.data() as BusinessConfig;
      if (!currentData.name || currentData.name.includes('Kimuchu') || currentData.name.includes('Club') || currentData.name.includes('Savanna') || currentData.name.includes('Valentine') || currentData.name.includes('Untitled')) {
        await setDoc(bizRef, {
          name: "Raphajoy Chemist & Pharmacy",
          receiptHeader: "RAPHAJOY CHEMIST & PHARMACY\nLicensed Prescription & Health Care",
          tillNumber: "888999"
        }, { merge: true });
      }
    }

    // 2. Check/Create Categories
    const catColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories');
    const catSnap = await getDocs(catColRef);
    if (catSnap.empty) {
      const defaultCategories: Category[] = [
        { id: 'cat-prescription', name: 'Prescription Drugs (Rx)', description: 'Antibiotics, antihypertensives & specialized medications' },
        { id: 'cat-pain', name: 'Analgesics & Pain Relief', description: 'Pain relievers, anti-inflammatories & migraine care' },
        { id: 'cat-cold', name: 'Cold, Flu & Cough', description: 'Cough syrups, decongestants & throat lozenges' },
        { id: 'cat-vitamins', name: 'Vitamins & Supplements', description: 'Multivitamins, immune boosters & minerals' },
        { id: 'cat-firstaid', name: 'First Aid & Wound Care', description: 'Bandages, antiseptics, gauze & cotton wool' },
        { id: 'cat-devices', name: 'Medical Devices & Equipment', description: 'Thermometers, BP monitors & blood sugar test strips' },
        { id: 'cat-personal', name: 'Personal Care & Hygiene', description: 'Antiseptic soaps, hand sanitizers & oral care' },
        { id: 'cat-baby', name: 'Baby Care & Maternity', description: 'Baby formula, diapers, teething gels & aqueous cream' }
      ];
      const catBatch = writeBatch(db);
      for (const cat of defaultCategories) {
        catBatch.set(doc(catColRef, cat.id), cat);
      }
      await catBatch.commit();
      cacheLocalCategories(defaultCategories);
    }

    // 3. Check/Create Products & Force Reset Food Items to Pharmacy
    const prodColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
    const prodSnap = await getDocs(prodColRef);
    let hasFoodItems = prodSnap.empty;
    if (!prodSnap.empty) {
      for (const d of prodSnap.docs) {
        const data = d.data();
        const name = (data.name || '').toLowerCase();
        if (name.includes('mukimo') || name.includes('chapati') || name.includes('cofee') || name.includes('chips') || name.includes('beer') || name.includes('ugali')) {
          hasFoodItems = true;
          break;
        }
      }
    }

    if (hasFoodItems) {
      await forceResetDatabaseToPharmacy();
    } else if (prodSnap.empty) {
      const defaultProducts: Product[] = [
        {
          id: 'prod-paracetamol',
          name: 'Paracetamol 500mg Tablets (Pack of 100)',
          categoryId: 'cat-pain',
          categoryName: 'Analgesics & Pain Relief',
          unitType: 'Pack',
          buyingPrice: 250,
          sellingPrice: 450,
          openingStock: 100,
          currentStock: 100,
          stockAdded: 0,
          minStockLevel: 15,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-ibuprofen',
          name: 'Ibuprofen 400mg Tablets (Box of 50)',
          categoryId: 'cat-pain',
          categoryName: 'Analgesics & Pain Relief',
          unitType: 'Box',
          buyingPrice: 350,
          sellingPrice: 600,
          openingStock: 80,
          currentStock: 80,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-amoxicillin',
          name: 'Amoxicillin 500mg Capsules (Box of 100)',
          categoryId: 'cat-prescription',
          categoryName: 'Prescription Drugs (Rx)',
          unitType: 'Box',
          buyingPrice: 800,
          sellingPrice: 1400,
          openingStock: 60,
          currentStock: 60,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-augmentin',
          name: 'Augmentin 625mg Tablets (Strip of 14)',
          categoryId: 'cat-prescription',
          categoryName: 'Prescription Drugs (Rx)',
          unitType: 'Strip',
          buyingPrice: 650,
          sellingPrice: 1100,
          openingStock: 45,
          currentStock: 45,
          stockAdded: 0,
          minStockLevel: 8,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-benylin',
          name: 'Benylin Chesty Cough Syrup 100ml',
          categoryId: 'cat-cold',
          categoryName: 'Cold, Flu & Cough',
          unitType: 'Bottle',
          buyingPrice: 300,
          sellingPrice: 550,
          openingStock: 50,
          currentStock: 50,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-panadol-cold',
          name: 'Panadol Cold & Flu Relief (Pack of 20)',
          categoryId: 'cat-cold',
          categoryName: 'Cold, Flu & Cough',
          unitType: 'Pack',
          buyingPrice: 180,
          sellingPrice: 320,
          openingStock: 90,
          currentStock: 90,
          stockAdded: 0,
          minStockLevel: 20,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-centrum',
          name: 'Centrum Multivitamin Tablets (Bottle of 60)',
          categoryId: 'cat-vitamins',
          categoryName: 'Vitamins & Supplements',
          unitType: 'Bottle',
          buyingPrice: 1200,
          sellingPrice: 1950,
          openingStock: 35,
          currentStock: 35,
          stockAdded: 0,
          minStockLevel: 5,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-vitaminc',
          name: 'Vitamin C 1000mg Effervescent (Tube of 20)',
          categoryId: 'cat-vitamins',
          categoryName: 'Vitamins & Supplements',
          unitType: 'Tube',
          buyingPrice: 400,
          sellingPrice: 700,
          openingStock: 40,
          currentStock: 40,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-firstaid-kit',
          name: 'First Aid Emergency Kit Box',
          categoryId: 'cat-firstaid',
          categoryName: 'First Aid & Wound Care',
          unitType: 'Piece',
          buyingPrice: 1500,
          sellingPrice: 2500,
          openingStock: 25,
          currentStock: 25,
          stockAdded: 0,
          minStockLevel: 5,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-hydrogen-peroxide',
          name: 'Hydrogen Peroxide 200ml & Cotton Wool Set',
          categoryId: 'cat-firstaid',
          categoryName: 'First Aid & Wound Care',
          unitType: 'Set',
          buyingPrice: 150,
          sellingPrice: 280,
          openingStock: 70,
          currentStock: 70,
          stockAdded: 0,
          minStockLevel: 15,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-thermometer',
          name: 'Digital Infrared Non-Contact Thermometer',
          categoryId: 'cat-devices',
          categoryName: 'Medical Devices & Equipment',
          unitType: 'Piece',
          buyingPrice: 1200,
          sellingPrice: 2200,
          openingStock: 20,
          currentStock: 20,
          stockAdded: 0,
          minStockLevel: 4,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-bp-monitor',
          name: 'Automatic Upper Arm Blood Pressure Monitor',
          categoryId: 'cat-devices',
          categoryName: 'Medical Devices & Equipment',
          unitType: 'Piece',
          buyingPrice: 3500,
          sellingPrice: 5800,
          openingStock: 12,
          currentStock: 12,
          stockAdded: 0,
          minStockLevel: 3,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-glucometer-strips',
          name: 'Blood Glucose Test Strips (Pack of 50)',
          categoryId: 'cat-devices',
          categoryName: 'Medical Devices & Equipment',
          unitType: 'Pack',
          buyingPrice: 1800,
          sellingPrice: 2800,
          openingStock: 30,
          currentStock: 30,
          stockAdded: 0,
          minStockLevel: 8,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-dettol',
          name: 'Dettol Antiseptic Liquid 500ml',
          categoryId: 'cat-personal',
          categoryName: 'Personal Care & Hygiene',
          unitType: 'Bottle',
          buyingPrice: 450,
          sellingPrice: 750,
          openingStock: 60,
          currentStock: 60,
          stockAdded: 0,
          minStockLevel: 12,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-sanitizer',
          name: 'Alcohol Hand Sanitizer 500ml Pump',
          categoryId: 'cat-personal',
          categoryName: 'Personal Care & Hygiene',
          unitType: 'Bottle',
          buyingPrice: 250,
          sellingPrice: 450,
          openingStock: 85,
          currentStock: 85,
          stockAdded: 0,
          minStockLevel: 15,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-sudocrem',
          name: 'Sudocrem Healing Antiseptic Cream 250g',
          categoryId: 'cat-baby',
          categoryName: 'Baby Care & Maternity',
          unitType: 'Tub',
          buyingPrice: 700,
          sellingPrice: 1200,
          openingStock: 40,
          currentStock: 40,
          stockAdded: 0,
          minStockLevel: 8,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-panadol-baby',
          name: 'Panadol Children Pediatric Suspension 100ml',
          categoryId: 'cat-baby',
          categoryName: 'Baby Care & Maternity',
          unitType: 'Bottle',
          buyingPrice: 280,
          sellingPrice: 500,
          openingStock: 50,
          currentStock: 50,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      for (const prod of defaultProducts) {
        await setDoc(doc(prodColRef, prod.id), prod);
      }
    }

    // 4. Check/Create Current Business Day
    const todayStr = new Date().toISOString().split('T')[0];
    const dayRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'businessDays', todayStr);
    const daySnap = await getDoc(dayRef);
    if (!daySnap.exists()) {
      const todayDay: BusinessDay = {
        id: todayStr,
        date: todayStr,
        openingTime: "08:00",
        closingTime: "21:00",
        openedBy: currentUser?.email || 'admin@raphajoy.com',
        status: 'open',
        createdAt: Date.now()
      };
      await setDoc(dayRef, todayDay);
    }

    // 5. Ensure current user profile exists in Firestore users collection
    if (currentUser && currentUser.uid) {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const email = currentUser.email || '';
        const role = email.includes('cashier') ? 'cashier' : 'admin';
        const profile: UserProfile = {
          uid: currentUser.uid,
          email: email,
          name: currentUser.displayName || (role === 'admin' ? 'Pharm. Raphajoy' : 'Lead Chemist Cashier'),
          role: role,
          businessId: DEFAULT_BUSINESS_ID,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, profile);
      }
    }

  } catch (err) {
    console.error("Error initializing database seed:", err);
  }
}

export async function forceResetDatabaseToPharmacy() {
  try {
    // Overwrite business config
    const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
    const freshBiz: BusinessConfig = {
      id: DEFAULT_BUSINESS_ID,
      name: "Raphajoy Chemist & Pharmacy",
      phone: "+254 722 000 111",
      location: "Nairobi, Kenya",
      address: "Main Street, Medical Plaza, Nairobi",
      currency: "KSh",
      openingTime: "08:00",
      closingTime: "21:00",
      lowStockThreshold: 5,
      receiptHeader: "RAPHAJOY CHEMIST & PHARMACY\nLicensed Prescription & Health Care",
      receiptFooter: "Get Well Soon! Thank you for choosing Raphajoy.",
      tillNumber: "888999"
    };
    await setDoc(bizRef, freshBiz);
    localStorage.setItem('bar_pos_business_config', JSON.stringify(freshBiz));
    localStorage.removeItem('bar_pos_local_sales');
    localStorage.removeItem('bar_pos_open_tabs');
    localStorage.removeItem('bar_pos_offline_sales_queue');
    localStorage.removeItem('bar_pos_local_movements');

    // Re-seed categories
    const catColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories');
    const existingCats = await getDocs(catColRef);
    const catBatch = writeBatch(db);
    for (const d of existingCats.docs) {
      catBatch.delete(d.ref);
    }

    const defaultCategories: Category[] = [
      { id: 'cat-prescription', name: 'Prescription Drugs (Rx)', description: 'Antibiotics, antihypertensives & specialized medications' },
      { id: 'cat-pain', name: 'Analgesics & Pain Relief', description: 'Pain relievers, anti-inflammatories & migraine care' },
      { id: 'cat-cold', name: 'Cold, Flu & Cough', description: 'Cough syrups, decongestants & throat lozenges' },
      { id: 'cat-vitamins', name: 'Vitamins & Supplements', description: 'Multivitamins, immune boosters & minerals' },
      { id: 'cat-firstaid', name: 'First Aid & Wound Care', description: 'Bandages, antiseptics, gauze & cotton wool' },
      { id: 'cat-devices', name: 'Medical Devices & Equipment', description: 'Thermometers, BP monitors & blood sugar test strips' },
      { id: 'cat-personal', name: 'Personal Care & Hygiene', description: 'Antiseptic soaps, hand sanitizers & oral care' },
      { id: 'cat-baby', name: 'Baby Care & Maternity', description: 'Baby formula, diapers, teething gels & aqueous cream' }
    ];
    for (const cat of defaultCategories) {
      catBatch.set(doc(catColRef, cat.id), cat);
    }
    await catBatch.commit();
    cacheLocalCategories(defaultCategories);

    // Re-seed products
    const prodColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
    const existingProds = await getDocs(prodColRef);
    const prodBatch = writeBatch(db);
    for (const d of existingProds.docs) {
      prodBatch.delete(d.ref);
    }

    const defaultProducts: Product[] = [
      {
        id: 'prod-paracetamol',
        name: 'Paracetamol 500mg Tablets (Pack of 100)',
        categoryId: 'cat-pain',
        categoryName: 'Analgesics & Pain Relief',
        barcode: '6161100100015',
        barcodeType: 'EAN13',
        unitType: 'Pack',
        buyingPrice: 250,
        sellingPrice: 450,
        openingStock: 100,
        currentStock: 100,
        stockAdded: 0,
        minStockLevel: 15,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-ibuprofen',
        name: 'Ibuprofen 400mg Tablets (Box of 50)',
        categoryId: 'cat-pain',
        categoryName: 'Analgesics & Pain Relief',
        barcode: '6161100100022',
        barcodeType: 'EAN13',
        unitType: 'Box',
        buyingPrice: 350,
        sellingPrice: 600,
        openingStock: 80,
        currentStock: 80,
        stockAdded: 0,
        minStockLevel: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-amoxicillin',
        name: 'Amoxicillin 500mg Capsules (Box of 100)',
        categoryId: 'cat-prescription',
        categoryName: 'Prescription Drugs (Rx)',
        barcode: '6161100100039',
        barcodeType: 'EAN13',
        unitType: 'Box',
        buyingPrice: 800,
        sellingPrice: 1400,
        openingStock: 60,
        currentStock: 60,
        stockAdded: 0,
        minStockLevel: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-augmentin',
        name: 'Augmentin 625mg Tablets (Strip of 14)',
        categoryId: 'cat-prescription',
        categoryName: 'Prescription Drugs (Rx)',
        barcode: '6161100100046',
        barcodeType: 'EAN13',
        unitType: 'Strip',
        buyingPrice: 650,
        sellingPrice: 1100,
        openingStock: 45,
        currentStock: 45,
        stockAdded: 0,
        minStockLevel: 8,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-benylin',
        name: 'Benylin Chesty Cough Syrup 100ml',
        categoryId: 'cat-cold',
        categoryName: 'Cold, Flu & Cough',
        barcode: '6161100100053',
        barcodeType: 'EAN13',
        unitType: 'Bottle',
        buyingPrice: 300,
        sellingPrice: 550,
        openingStock: 50,
        currentStock: 50,
        stockAdded: 0,
        minStockLevel: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-panadol-cold',
        name: 'Panadol Cold & Flu Relief (Pack of 20)',
        categoryId: 'cat-cold',
        categoryName: 'Cold, Flu & Cough',
        barcode: '6161100100060',
        barcodeType: 'EAN13',
        unitType: 'Pack',
        buyingPrice: 180,
        sellingPrice: 320,
        openingStock: 90,
        currentStock: 90,
        stockAdded: 0,
        minStockLevel: 20,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-centrum',
        name: 'Centrum Multivitamin Tablets (Bottle of 60)',
        categoryId: 'cat-vitamins',
        categoryName: 'Vitamins & Supplements',
        barcode: '6161100100077',
        barcodeType: 'EAN13',
        unitType: 'Bottle',
        buyingPrice: 1200,
        sellingPrice: 1950,
        openingStock: 35,
        currentStock: 35,
        stockAdded: 0,
        minStockLevel: 5,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-vitaminc',
        name: 'Vitamin C 1000mg Effervescent (Tube of 20)',
        categoryId: 'cat-vitamins',
        categoryName: 'Vitamins & Supplements',
        barcode: '6161100100084',
        barcodeType: 'EAN13',
        unitType: 'Tube',
        buyingPrice: 400,
        sellingPrice: 700,
        openingStock: 40,
        currentStock: 40,
        stockAdded: 0,
        minStockLevel: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-firstaid-kit',
        name: 'First Aid Emergency Kit Box',
        categoryId: 'cat-firstaid',
        categoryName: 'First Aid & Wound Care',
        barcode: '6161100100091',
        barcodeType: 'EAN13',
        unitType: 'Piece',
        buyingPrice: 1500,
        sellingPrice: 2500,
        openingStock: 25,
        currentStock: 25,
        stockAdded: 0,
        minStockLevel: 5,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-hydrogen-peroxide',
        name: 'Hydrogen Peroxide 200ml & Cotton Wool Set',
        categoryId: 'cat-firstaid',
        categoryName: 'First Aid & Wound Care',
        barcode: '6161100100107',
        barcodeType: 'EAN13',
        unitType: 'Set',
        buyingPrice: 150,
        sellingPrice: 280,
        openingStock: 70,
        currentStock: 70,
        stockAdded: 0,
        minStockLevel: 15,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-thermometer',
        name: 'Digital Infrared Non-Contact Thermometer',
        categoryId: 'cat-devices',
        categoryName: 'Medical Devices & Equipment',
        barcode: '6161100100114',
        barcodeType: 'EAN13',
        unitType: 'Piece',
        buyingPrice: 1200,
        sellingPrice: 2200,
        openingStock: 20,
        currentStock: 20,
        stockAdded: 0,
        minStockLevel: 4,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-bp-monitor',
        name: 'Automatic Upper Arm Blood Pressure Monitor',
        categoryId: 'cat-devices',
        categoryName: 'Medical Devices & Equipment',
        barcode: '6161100100121',
        barcodeType: 'EAN13',
        unitType: 'Piece',
        buyingPrice: 3500,
        sellingPrice: 5800,
        openingStock: 12,
        currentStock: 12,
        stockAdded: 0,
        minStockLevel: 3,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-glucometer-strips',
        name: 'Blood Glucose Test Strips (Pack of 50)',
        categoryId: 'cat-devices',
        categoryName: 'Medical Devices & Equipment',
        barcode: '6161100100138',
        barcodeType: 'EAN13',
        unitType: 'Pack',
        buyingPrice: 1800,
        sellingPrice: 2800,
        openingStock: 30,
        currentStock: 30,
        stockAdded: 0,
        minStockLevel: 8,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-dettol',
        name: 'Dettol Antiseptic Liquid 500ml',
        categoryId: 'cat-personal',
        categoryName: 'Personal Care & Hygiene',
        barcode: '6161100100145',
        barcodeType: 'EAN13',
        unitType: 'Bottle',
        buyingPrice: 450,
        sellingPrice: 750,
        openingStock: 60,
        currentStock: 60,
        stockAdded: 0,
        minStockLevel: 12,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-sanitizer',
        name: 'Alcohol Hand Sanitizer 500ml Pump',
        categoryId: 'cat-personal',
        categoryName: 'Personal Care & Hygiene',
        barcode: '6161100100152',
        barcodeType: 'EAN13',
        unitType: 'Bottle',
        buyingPrice: 250,
        sellingPrice: 450,
        openingStock: 85,
        currentStock: 85,
        stockAdded: 0,
        minStockLevel: 15,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-sudocrem',
        name: 'Sudocrem Healing Antiseptic Cream 250g',
        categoryId: 'cat-baby',
        categoryName: 'Baby Care & Maternity',
        barcode: '6161100100169',
        barcodeType: 'EAN13',
        unitType: 'Tub',
        buyingPrice: 700,
        sellingPrice: 1200,
        openingStock: 40,
        currentStock: 40,
        stockAdded: 0,
        minStockLevel: 8,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-panadol-baby',
        name: 'Panadol Children Pediatric Suspension 100ml',
        categoryId: 'cat-baby',
        categoryName: 'Baby Care & Maternity',
        barcode: '6161100100176',
        barcodeType: 'EAN13',
        unitType: 'Bottle',
        buyingPrice: 280,
        sellingPrice: 500,
        openingStock: 50,
        currentStock: 50,
        stockAdded: 0,
        minStockLevel: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    for (const prod of defaultProducts) {
      prodBatch.set(doc(prodColRef, prod.id), prod);
    }
    await prodBatch.commit();
    cacheLocalProducts(defaultProducts);

    return { success: true };
  } catch (err: any) {
    console.error("Error resetting database:", err);
    throw err;
  }
}
