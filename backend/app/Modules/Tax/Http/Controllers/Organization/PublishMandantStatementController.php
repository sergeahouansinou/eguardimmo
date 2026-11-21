<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Tax\Actions\PublishMandantStatement;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Requests\PublishMandantStatementRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Queries\Summaries;

final class PublishMandantStatementController
{
    public function __invoke(string $statement, PublishMandantStatementRequest $requete, Summaries $syntheses, PublishMandantStatement $publication): SummaryResource
    {
        /** @var User $user */
        $user = $requete->user();
        $resultat = $publication->handle($syntheses->find($statement, SummaryScope::Mandant), $requete->lockVersion(), (string) $user->getKey());

        return new SummaryResource($resultat['summary'], true);
    }
}
