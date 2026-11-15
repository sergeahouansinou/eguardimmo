<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\RenewCertificateData;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\CertificateDataSchema;
use App\Modules\Documents\Support\CertificateTypes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class RenewCertificate
{
    public function __construct(private CertificateTypes $types) {}

    public function handle(string $certificateId, RenewCertificateData $data): Certificate
    {
        if (! Str::isUuid($certificateId)) {
            throw ErrorCode::CertificateNotFound->problem();
        }

        if ($data->storedFileId !== null && ! StoredFile::query()->whereKey($data->storedFileId)->exists()) {
            throw ErrorCode::FileNotFound->problem();
        }

        return DB::transaction(function () use ($certificateId, $data): Certificate {
            $ancienne = Certificate::query()->whereKey($certificateId)->lockForUpdate()->first() ?? throw ErrorCode::CertificateNotFound->problem();

            if (Certificate::query()->where('replaces_id', $ancienne->id)->exists()) {
                throw ErrorCode::CertificateAlreadyReplaced->problem();
            }

            $type = $this->types->find($ancienne->certificate_type_term_id);
            $valeurs = CertificateDataSchema::validate($this->types->dataSchema($type), $data->data);
            $mois = $this->types->defaultValidityMonths($type);

            return Certificate::query()->create([
                'subject_type' => $ancienne->subject_type,
                'subject_id' => $ancienne->subject_id,
                'certificate_type_term_id' => $ancienne->certificate_type_term_id,
                'reference' => $data->reference,
                'issuer_party_id' => $data->issuerPartyId ?? $ancienne->issuer_party_id,
                'issued_on' => $data->issuedOn,
                'expires_on' => $data->expiresOn ?? ($mois === null ? null : $data->issuedOn->addMonthsNoOverflow($mois)),
                'data' => $valeurs,
                'stored_file_id' => $data->storedFileId,
                'replaces_id' => $ancienne->id,
                'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);
        });
    }
}
