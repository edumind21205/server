const cloudinary = require('cloudinary').v2;

// Configure your credentials
cloudinary.config({
  cloud_name: 'dgedargei',
  api_key: '755797721741655',
  api_secret: 'Wz-AbsqnuEBVC0DbhdvKbYXx6jc',
});

// Replace with your public_id (without extension)
const publicId = 'edumids/pdfs/zsjql0xvi4nkvwmotgzw';

cloudinary.api.resource(publicId, { resource_type: 'raw' }, function(error, result) {
  if (error) {
    console.error('Error (raw, no .pdf):', error);
    // Try with .pdf
    cloudinary.api.resource(publicId + '.pdf', { resource_type: 'raw' }, function(error2, result2) {
      if (error2) {
        console.error('Error (raw, with .pdf):', error2);
        // Try as image
        cloudinary.api.resource(publicId + '.pdf', { resource_type: 'image' }, function(error3, result3) {
          if (error3) {
            console.error('Error (image, with .pdf):', error3);
          } else {
            console.log('Resource type (image):', result3.resource_type);
            console.log('Full resource info (image):', result3);
          }
        });
      } else {
        console.log('Resource type (raw, with .pdf):', result2.resource_type);
        console.log('Full resource info (raw, with .pdf):', result2);
      }
    });
  } else {
    console.log('Resource type (raw, no .pdf):', result.resource_type);
    console.log('Full resource info (raw, no .pdf):', result);
  }
});