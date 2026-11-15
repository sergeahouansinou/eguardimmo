<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Requests;

use App\Modules\Documents\Data\RenewCertificateData;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class RenewCertificateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return self::fields();
    }

    /**
     * @return array<string, list<mixed>>
     */
    public static function fields(): array
    {
        return [
            'reference' => ['nullable', 'string', 'max:120'],
            'issuer_party_id' => ['nullable', 'uuid'],
            'issued_on' => ['required', 'date_format:Y-m-d'],
            'expires_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:issued_on'],
            'values' => ['nullable', 'array'],
            'stored_file_id' => ['nullable', 'uuid'],
        ];
    }

    public function toData(): RenewCertificateData
    {
        /** @var array<string, mixed> $valeurs */
        $valeurs = $this->validated('values', []) ?? [];

        return new RenewCertificateData(
            $this->filled('reference') ? (string) $this->validated('reference') : null,
            $this->filled('issuer_party_id') ? (string) $this->validated('issuer_party_id') : null,
            CarbonImmutable::parse((string) $this->validated('issued_on')),
            $this->filled('expires_on') ? CarbonImmutable::parse((string) $this->validated('expires_on')) : null,
            $valeurs,
            $this->filled('stored_file_id') ? (string) $this->validated('stored_file_id') : null,
        );
    }
}
