<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Models;

use App\Modules\Mandates\Database\Factories\MandateDocumentFactory;
use App\Modules\Mandates\Enums\DocumentUploader;
use App\Modules\Mandates\Enums\MandateDocumentKind;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Pièce du mandat que l'agence partage avec le mandant (`shared_at`) ; le retrait du partage (`revoked_at`) ne supprime pas la pièce.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandate_id
 * @property string $stored_file_id
 * @property MandateDocumentKind $kind
 * @property DocumentUploader $uploaded_by_kind
 * @property string|null $shared_by_user_id
 * @property Carbon|null $shared_at
 * @property Carbon|null $revoked_at
 * @property-read Mandate $mandate
 */
#[UseFactory(MandateDocumentFactory::class)]
final class MandateDocument extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<MandateDocumentFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['mandate_id', 'stored_file_id', 'kind', 'uploaded_by_kind', 'shared_by_user_id', 'shared_at', 'revoked_at'];

    /**
     * @return BelongsTo<Mandate, $this>
     */
    public function mandate(): BelongsTo
    {
        return $this->belongsTo(Mandate::class);
    }

    protected function casts(): array
    {
        return [
            'kind' => MandateDocumentKind::class,
            'uploaded_by_kind' => DocumentUploader::class,
            'shared_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }
}
