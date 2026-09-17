@app.route('/patients/import', methods=['GET', 'POST'])
def import_patients():

    if request.method == 'GET':
        return render_template(
            'import-patients.html',
            title='Import patients'
        )

    data = request.get_json(silent=True)

    if not data or not isinstance(data.get('patients'), list):
        return jsonify({
            'error': 'Invalid import data.'
        }), 400

    imported = 0
    skipped = 0

    connection = get_connection()

    try:

        with connection:

            connection.execute('BEGIN IMMEDIATE')

            for patient in data['patients']:

                first_name = str(
                    patient.get('first_name', '')
                ).strip()

                last_name = str(
                    patient.get('last_name', '')
                ).strip()

                date_of_birth = str(
                    patient.get('date_of_birth', '')
                ).strip()

                gender = str(
                    patient.get('gender', '')
                ).strip()

                phone = str(
                    patient.get('phone', '')
                ).strip()

                email = str(
                    patient.get('email', '')
                ).strip()

                address = str(
                    patient.get('address', '')
                ).strip()

                blood_group = str(
                    patient.get('blood_group', '')
                ).strip()

                emergency_contact = str(
                    patient.get('emergency_contact', '')
                ).strip()

                allergies = str(
                    patient.get('allergies', '')
                ).strip()


                # Required fields

                if not first_name:
                    skipped += 1
                    continue

                if not date_of_birth:
                    skipped += 1
                    continue

                if not phone:
                    skipped += 1
                    continue


                # Check for duplicate

                duplicate = connection.execute(
                    """
                    SELECT patient_id
                    FROM patients
                    WHERE workspace_id=?
                    AND lower(trim(first_name))=lower(?)
                    AND lower(trim(COALESCE(last_name,'')))=lower(?)
                    AND date_of_birth=?
                    AND phone=?
                    """,
                    (
                        g.user['workspace_id'],
                        first_name,
                        last_name,
                        date_of_birth,
                        phone
                    )
                ).fetchone()


                if duplicate:

                    skipped += 1

                    continue


                patient_id = generate_patient_id(
                    connection
                )


                insert_record(
                    connection,
                    'patients',
                    {
                        'patient_id': patient_id,
                        'workspace_id': g.user['workspace_id'],

                        'first_name': first_name,
                        'last_name': last_name,

                        'date_of_birth':
                            date_of_birth,

                        'gender': gender,

                        'phone': phone,

                        'email': email,

                        'address': address,

                        'blood_group':
                            blood_group,

                        'emergency_contact':
                            emergency_contact,

                        'allergies':
                            allergies
                    }
                )


                record_event(
                    'create',
                    'patient',
                    patient_id
                )


                imported += 1


        return jsonify({
            'success': True,
            'imported': imported,
            'skipped': skipped
        })


    except Exception as error:

        connection.rollback()

        return jsonify({
            'error': 'Import failed. Please check the CSV data.'
        }), 500
