<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Models;

use App\Modules\Inspections\Database\Factories\InspectionFactory;
use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\InspectionPerformer;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * État des lieux réalisé hors application, enregistré par l'équipe puis publié au locataire (ADR 0036, décision 6).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property InspectionKind $kind
 * @property Carbon $performed_on
 * @property InspectionPerformer $performed_by
 * @property string $stored_file_id
 * @property list<array{name: string, capacity: string, date: string}> $signatories
 * @property bool|null $exit_matches_entry
 * @property Carbon|null $published_at
 * @property string|null $published_by_user_id
 * @property string $created_by_user_id
 * @property string $client_id
 * @property int $lock_version
 * @property Carbon $created_at
 */
#[UseFactory(InspectionFactory::class)]
final class Inspection extends Model
{
    use BelongsToOrganization;

    /** @use HasFactory<InspectionFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'kind', 'performed_on', 'performed_by', 'stored_file_id', 'signatories', 'exit_matches_entry', 'published_at', 'published_by_user_id', 'created_by_user_id', 'client_id', 'lock_version'];

    protected $attributes = ['exit_matches_entry' => null, 'published_at' => null, 'published_by_user_id' => null, 'lock_version' => 1];

    protected function casts(): array
    {
        return [
            'kind' => InspectionKind::class,
            'performed_on' => 'date',
            'performed_by' => InspectionPerformer::class,
            'signatories' => 'encrypted:array',
            'exit_matches_entry' => 'boolean',
            'published_at' => 'datetime',
        ];
    }
}
