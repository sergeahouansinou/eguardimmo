<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\ActivityLog;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property AuditLog $resource
 */
final class ActivityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $entree = $this->resource;
        $divulgue = $entree->getAttribute(ActivityLog::ATTRIBUT_DIVULGUE) === true;
        $auteur = $entree->relationLoaded(ActivityLog::RELATION_AUTEUR) ? $entree->getRelation(ActivityLog::RELATION_AUTEUR) : null;

        return [
            'id' => $entree->id,
            'occurred_at' => $entree->occurred_at->format('Y-m-d\TH:i:s.uP'),
            'action' => $entree->action,
            'actor' => $auteur instanceof User
                ? ['id' => $auteur->id, 'name' => $auteur->name, 'email' => $auteur->email]
                : ($entree->actor_user_id !== null ? ['id' => $entree->actor_user_id, 'name' => null, 'email' => null] : null),
            'organization_id' => $entree->organization_id,
            'subject' => $entree->subject_type !== null ? ['type' => $entree->subject_type, 'id' => $divulgue ? $entree->subject_id : null] : null,
            'changes' => $divulgue ? $entree->changes : null,
            'metadata' => $divulgue ? $entree->metadata : null,
            'request_id' => $entree->request_id,
            'route' => $entree->route,
            'ip' => $divulgue ? $entree->ip : null,
            'user_agent' => $divulgue ? $entree->user_agent : null,
        ];
    }
}
