<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Database\Factories;

use App\Modules\Mandates\Enums\DocumentUploader;
use App\Modules\Mandates\Enums\MandateDocumentKind;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateDocument;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `stored_file_id` est un fichier de Documents : l'appelant fournit un fichier réel quand le test le télécharge.
 *
 * @extends Factory<MandateDocument>
 */
final class MandateDocumentFactory extends Factory
{
    protected $model = MandateDocument::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'mandate_id' => Mandate::factory(),
            'stored_file_id' => Str::uuid7()->toString(),
            'kind' => MandateDocumentKind::Diagnostic,
            'uploaded_by_kind' => DocumentUploader::Agency,
            'shared_by_user_id' => Str::uuid7()->toString(),
            'shared_at' => now(),
        ];
    }

    public function revoked(): self
    {
        return $this->state(fn (): array => ['revoked_at' => now()]);
    }

    public function unshared(): self
    {
        return $this->state(['shared_at' => null, 'shared_by_user_id' => null]);
    }
}
