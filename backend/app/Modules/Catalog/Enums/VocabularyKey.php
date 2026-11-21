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
    case MandateType = 'mandate_type';
    case InvoiceItem = 'invoice_item';
    case TaxRate = 'tax_rate';
    case InterventionNature = 'intervention_nature';
    case ChargeRubric = 'charge_rubric';

    public function title(): string
    {
        return match ($this) {
            self::LegalForm => 'Formes juridiques',
            self::ContactCategory => 'Catégories de contacts',
            self::UnitType => 'Types de lots',
            self::LeaseComponent => 'Composantes du loyer',
            self::CertificateType => 'Types de pièces à échéance',
            self::ExpenseCategory => 'Catégories de dépenses',
            self::MandateType => 'Types de mandats',
            self::InvoiceItem => 'Natures de lignes de facture',
            self::TaxRate => 'Taux de taxe',
            self::InterventionNature => 'Natures d\'intervention',
            self::ChargeRubric => 'Rubriques de charges récupérables',
        };
    }

    public function extensible(): bool
    {
        return $this !== self::LegalForm && $this !== self::TaxRate && $this !== self::ChargeRubric;
    }

    /**
     * Un taux de taxe et une rubrique de charges sont des données légales : l'organisation ne les renomme ni ne les masque.
     */
    public function overridable(): bool
    {
        return $this !== self::TaxRate && $this !== self::ChargeRubric;
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
            self::MandateType => MandateTypeSemantic::cases(),
            self::InvoiceItem => InvoiceItemSemantic::cases(),
            self::TaxRate => [],
            self::InterventionNature => InterventionNatureSemantic::cases(),
            self::ChargeRubric => [],
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
            self::TaxRate => [
                'country' => ['required', 'string', 'regex:/^[A-Z]{2}$/'],
                'tax_code' => ['required', 'string', 'in:vat,gst,qst'],
                'category' => ['required', 'string', 'in:S,Z,E,AE,O'],
                'rate_pcm' => ['required', 'integer', 'min:0', 'max:100000'],
                'effective_from' => ['required', 'date_format:Y-m-d'],
                'effective_to' => ['nullable', 'date_format:Y-m-d'],
            ],
            self::InterventionNature => [
                'tenant_chargeable' => ['nullable', 'boolean'],
                'insurance_required' => ['nullable', 'boolean'],
                'default_responsibility' => ['nullable', 'string', 'in:owner,tenant,shared,undetermined'],
                'expense_semantic' => ['nullable', 'string', 'in:'.implode(',', array_map(fn (ExpenseCategorySemantic $sens): string => $sens->value, ExpenseCategorySemantic::cases()))],
            ],
            self::ExpenseCategory => ['recoverable_by_default' => ['nullable', 'boolean']],
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
