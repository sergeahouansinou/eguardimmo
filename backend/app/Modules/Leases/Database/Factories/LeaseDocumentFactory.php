<?php

declare(strict_types=1);

namespace App\Modules\Leases\Database\Factories;

use App\Modules\Leases\Enums\LeaseDocumentKind;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseDocument;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `stored_file_id` est un fichier de Documents : l'appelant fournit un fichier réel quand le test le télécharge.
 *
 * @extends Factory<LeaseDocument>
 */
final class LeaseDocumentFactory extends Factory
{
    protected $model = LeaseDocument::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Lease::factory(),
            'party_id' => null,
            'stored_file_id' => Str::uuid7()->toString(),
            'kind' => LeaseDocumentKind::Diagnostic,
            'shared_by_user_id' => Str::uuid7()->toString(),
            'shared_at' => now(),
        ];
    }

    public function revoked(): self
    {
        return $this->state(fn (): array => ['revoked_at' => now()]);
    }
}
