<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

use App\Modules\Catalog\Support\DataSchemaRules;

enum VocabularyKey: string
{
    case LegalForm = 'legal_form';
    case ContactCategory = 'contact_category';
    case UnitType = 'unit_type';
    case LeaseComponent = 'lease_component';
    case CertificateType = 'certificate_type';
    case ExpenseCategory = 'expense_category';

    public function title(): string
    {
        return match ($this) {
            self::LegalForm => 'Formes juridiques',
            self::ContactCategory => 'Catégories de contacts',
            self::UnitType => 'Types de lots',
            self::LeaseComponent => 'Composantes du loyer',
            self::CertificateType => 'Types de pièces à échéance',
            self::ExpenseCategory => 'Catégories de dépenses',
        };
    }

    public function extensible(): bool
    {
        return $this !== self::LegalForm;
    }

    public function hierarchical(): bool
    {
        return $this === self::ExpenseCategory;
    }

    /**
     * @return list<string>
     */
    public function semantics(): array
    {
        $cas = match ($this) {
            self::LegalForm => [],
            self::ContactCategory => ContactCategorySemantic::cases(),
            self::UnitType => UnitTypeSemantic::cases(),
            self::LeaseComponent => LeaseComponentSemantic::cases(),
            self::CertificateType => CertificateTypeSemantic::cases(),
            self::ExpenseCategory => ExpenseCategorySemantic::cases(),
        };

        return array_map(fn (\BackedEnum $sens): string => (string) $sens->value, $cas);
    }

    public function semanticRequired(): bool
    {
        return $this->semantics() !== [] && $this !== self::CertificateType;
    }

    /**
     * Règles de validation de chaque clé de `metadata` ; toute autre clé est refusée.
     *
     * @return array<string, list<mixed>>
     */
    public function metadataRules(): array
    {
        return match ($this) {
            self::LegalForm => ['country' => ['nullable', 'string', 'regex:/^[A-Z]{2}$/']],
            self::CertificateType => [
                'default_validity_months' => ['nullable', 'integer', 'min:1', 'max:600'],
                'reminder_days' => ['nullable', 'integer', 'min:0', 'max:730'],
                'retention_years' => ['nullable', 'integer', 'min:0', 'max:50'],
                'data_schema' => ['nullable', 'array', 'max:20', DataSchemaRules::schema()],
                'data_schema.*' => ['array'],
                'data_schema.*.type' => ['required', 'string', 'in:string,integer,number,boolean,date'],
                'data_schema.*.required' => ['sometimes', DataSchemaRules::required()],
                'data_schema.*.enum' => ['sometimes', 'array', 'min:1', 'max:50'],
                'data_schema.*.enum.*' => ['string', 'max:100'],
                'data_schema.*.min' => ['sometimes', 'numeric'],
                'data_schema.*.max' => ['sometimes', 'numeric'],
            ],
            default => [],
        };
    }
}
