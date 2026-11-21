<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Http\Requests\SearchAccountsRequest;
use App\Modules\Identity\Http\Resources\Console\AccountSummaryResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\AccountFiles;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SearchAccountsController
{
    public function __invoke(SearchAccountsRequest $requete, AccountFiles $fiches, RecordAudit $audit): AnonymousResourceCollection
    {
        $email = $requete->validated('email');
        $compte = is_string($email)
            ? $fiches->byEmail($email)
            : User::withTrashed()->with('operator')->find(strtolower((string) $requete->validated('id')));

        $audit->handle('console.account.searched', metadata: [
            'by' => is_string($email) ? 'email' : 'id',
            'email_fingerprint' => is_string($email) ? $audit->fingerprint($email) : null,
            'found' => $compte !== null,
        ]);

        return AccountSummaryResource::collection($compte === null ? [] : [$compte]);
    }
}
