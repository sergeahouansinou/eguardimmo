<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('payout_account_requests')->select(['id', 'proof_file_id', 'mandant_party_id'])->orderBy('id')->chunk(200, function ($demandes): void {
            foreach ($demandes as $demande) {
                DB::table('stored_files')
                    ->where('id', $demande->proof_file_id)
                    ->where('subject_type', 'party')
                    ->where('subject_id', $demande->mandant_party_id)
                    ->update(['subject_type' => DocumentSubject::PAYOUT_ACCOUNT_REQUEST, 'subject_id' => $demande->id]);
            }
        });
    }

    public function down(): void
    {
        // Le sujet dédié reste en place : la route générique refuse ces pièces, on ne les rouvre pas.
    }
};
