<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Modules\Parties\Database\Factories\PartyFactory;
use App\Modules\Parties\Enums\PartyKind;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property PartyKind $kind
 * @property string $display_name
 * @property string|null $last_name
 * @property string|null $first_name
 * @property string|null $company_name
 * @property string|null $legal_form_term_id
 * @property Carbon|null $birth_date
 * @property array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null $address
 * @property string $language
 * @property string|null $user_id
 * @property array<string, mixed> $custom_fields
 * @property int $lock_version
 * @property Carbon|null $anonymized_at
 * @property Carbon|null $archived_at
 */
#[UseFactory(PartyFactory::class)]
final class Party extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<PartyFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['display_name', 'last_name', 'first_name', 'company_name', 'birth_date', 'address', 'custom_fields'];
    }

    public function isAnonymized(): bool
    {
        return $this->anonymized_at !== null;
    }

    /**
     * @return HasMany<ContactPoint, $this>
     */
    public function contactPoints(): HasMany
    {
        return $this->hasMany(ContactPoint::class);
    }

    /**
     * @return HasMany<PartyIdentifier, $this>
     */
    public function identifiers(): HasMany
    {
        return $this->hasMany(PartyIdentifier::class);
    }

    /**
     * @return HasMany<BankAccount, $this>
     */
    public function bankAccounts(): HasMany
    {
        return $this->hasMany(BankAccount::class);
    }

    /**
     * @return HasMany<PartyContactCategory, $this>
     */
    public function categories(): HasMany
    {
        return $this->hasMany(PartyContactCategory::class);
    }

    protected function casts(): array
    {
        return [
            'kind' => PartyKind::class,
            'birth_date' => 'date:Y-m-d',
            'address' => 'array',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
            'anonymized_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
}
