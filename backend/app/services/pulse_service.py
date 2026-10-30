from app.services.graph_service import graph_service


class PulseService:

    def dashboard(self, user_uid: str):

        return graph_service.network_stats(user_uid)

    def recently_active(self, user_uid: str, limit: int = 10):

        return graph_service.get_recently_active(user_uid, limit)


pulse_service = PulseService()